import { Inject, Injectable, Logger } from '@nestjs/common';
import { LLM_CLIENT, type LlmClient } from '../llm/llm-client';
import { normalizeAnswer } from '../common/normalize-answer';
import {
  buildGradingUser,
  GRADING_SCHEMA,
  GRADING_SYSTEM,
  type GradingResponse,
} from './grading.prompts';

export type RatingLabel = 'Again' | 'Hard' | 'Good' | 'Easy';

const RATING_LABELS: readonly RatingLabel[] = ['Again', 'Hard', 'Good', 'Easy'];

function isRatingLabel(v: unknown): v is RatingLabel {
  return (
    typeof v === 'string' && (RATING_LABELS as readonly string[]).includes(v)
  );
}

export interface OpenGradeInput {
  prompt: string;
  answer: string;
  /** A known-good answer, when the content provides one. */
  exemplar?: string;
  /** Optional grading guidance for the model. */
  rubric?: string;
}

export interface OpenGradeResult {
  rating: RatingLabel;
  /** Convenience: correct iff the learner recalled it at all (not "Again"). */
  correct: boolean;
  feedback: string;
  /** Revealed to the learner after answering (the exemplar, if any). */
  exemplar: string;
  gradedBy: 'ai' | 'fallback';
  /**
   * Whether `rating` reflects a real judgement of the answer. False only when
   * the model is unavailable AND there's no exemplar to match against — i.e. we
   * couldn't actually grade. The caller must NOT feed an unscored result into
   * FSRS, or the schedule fills with fake passes.
   */
  scored: boolean;
}

/** Grading must never hang the lesson — cap the model call. */
const GRADE_TIMEOUT_MS = 12_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('LLM grading timed out')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/**
 * AI grading for open / free-response Checks (G.3). The model judges answer
 * quality and returns a 4-level FSRS rating + feedback; that rating flows into
 * the FSRS write-back path (#6). Every failure mode degrades gracefully to a
 * deterministic fallback so a learner is never blocked by the grader.
 */
@Injectable()
export class GradingService {
  private readonly logger = new Logger(GradingService.name);

  constructor(@Inject(LLM_CLIENT) private readonly llm: LlmClient) {}

  async gradeOpen(input: OpenGradeInput): Promise<OpenGradeResult> {
    const exemplar = input.exemplar ?? '';

    if (input.answer.trim().length === 0) {
      return {
        rating: 'Again',
        correct: false,
        feedback: 'No answer was given.',
        exemplar,
        gradedBy: 'fallback',
        scored: true,
      };
    }

    if (this.llm.enabled) {
      try {
        const res = await withTimeout(
          this.llm.parseJson<GradingResponse>({
            task: 'grading',
            system: GRADING_SYSTEM,
            user: buildGradingUser(input),
            schema: GRADING_SCHEMA,
            schemaName: 'grade',
            cacheSystem: true,
            maxTokens: 512,
          }),
          GRADE_TIMEOUT_MS,
        );
        // Don't trust the rating blindly — if it's somehow off-enum, treating
        // it as a pass while ratingFromLabel maps it to Again would desync the
        // learner-facing result from the FSRS write. Fall back instead.
        if (!isRatingLabel(res.rating)) {
          throw new Error(
            `grader returned an invalid rating: ${String(res.rating)}`,
          );
        }
        return {
          rating: res.rating,
          correct: res.rating !== 'Again',
          feedback: typeof res.feedback === 'string' ? res.feedback : '',
          exemplar,
          gradedBy: 'ai',
          scored: true,
        };
      } catch (err) {
        this.logger.error(`AI grading failed, falling back: ${String(err)}`);
      }
    }

    return this.fallback(input, exemplar);
  }

  /**
   * Deterministic fallback when the model is unavailable. If an exemplar exists
   * we can still judge an exact (normalised) match; otherwise we accept the
   * answer rather than punish the learner for our outage, and flag it.
   */
  private fallback(input: OpenGradeInput, exemplar: string): OpenGradeResult {
    if (exemplar) {
      const correct =
        normalizeAnswer(input.answer) === normalizeAnswer(exemplar);
      return {
        rating: correct ? 'Good' : 'Again',
        correct,
        feedback: correct
          ? 'Correct.'
          : `Not quite — the expected answer was: ${exemplar}.`,
        exemplar,
        gradedBy: 'fallback',
        scored: true,
      };
    }
    // No model and no exemplar — we genuinely can't grade this. Accept the
    // answer so the learner isn't blocked, but mark it unscored so the caller
    // doesn't write a fake pass into FSRS.
    return {
      rating: 'Good',
      correct: true,
      feedback: 'Answer recorded (automatic grading was unavailable).',
      exemplar,
      gradedBy: 'fallback',
      scored: false,
    };
  }
}
