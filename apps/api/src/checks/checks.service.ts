import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { CheckResultDto } from '@sensei/types';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from '../mastery/mastery.service';
import { GradingService } from '../grading/grading.service';
import { WritingEvalService } from '../writing-eval/writing-eval.service';
import { Rating } from 'ts-fsrs';
import { ratingFromLabel } from '../mastery/fsrs';
import { exactMatch } from '../common/normalize-answer';

export interface GradeOptions {
  /** Learner's "I guessed" self-report (K.1). */
  guessed?: boolean;
}

/** The persisted Check `data` shape we read for grading. */
interface CheckData {
  answer?: unknown;
  exemplar?: unknown;
  rubric?: unknown;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

@Injectable()
export class ChecksService {
  private readonly logger = new Logger(ChecksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
    private readonly grading: GradingService,
    private readonly writingEval: WritingEvalService,
  ) {}

  /**
   * Grades a single Check answer and writes the result back into the learner's
   * FSRS schedule + mastery (G.3).
   *
   * Closed checks (a fixed `answer`, e.g. MULTIPLE_CHOICE) grade by exact
   * normalised match → deterministic Good/Again. Open / free-response checks
   * (no `answer`) are AI-graded (#8) into a 4-level rating + feedback, which
   * flows into the same write-back path. The correct answer is revealed only in
   * the response, never on the lesson payload (see CheckDto).
   */
  async grade(
    checkId: string,
    answer: string,
    userId: string,
    opts: GradeOptions = {},
  ): Promise<CheckResultDto> {
    const check = await this.prisma.check.findUnique({
      where: { id: checkId },
    });

    if (!check) {
      throw new NotFoundException(`Check not found: ${checkId}`);
    }

    const data = (check.data ?? {}) as CheckData;
    const fixedAnswer = asString(data.answer);

    // A MULTIPLE_CHOICE check is always closed (graded against its fixed
    // answer) — even if that answer is mis-stored, it must never silently
    // become AI-graded. Other formats are open only when no fixed answer is
    // present. A misconfigured closed check thus grades wrong (surfacing the
    // content bug) rather than quietly routing to the model.
    const isClosed =
      check.format === 'MULTIPLE_CHOICE' || fixedAnswer !== undefined;

    const graded = isClosed
      ? this.gradeClosed(answer, fixedAnswer ?? '', check.format)
      : await this.gradeOpen(check.prompt, answer, data);

    // "I guessed" downgrade (K.1): a correct multiple-choice answer the learner
    // admits guessing is treated as Hard, not Good — FSRS then reschedules it
    // sooner. Only ever downgrades, and only on the guess-prone format.
    const guessDowngrade =
      opts.guessed === true &&
      graded.correct &&
      check.format === 'MULTIPLE_CHOICE';
    const rating = guessDowngrade ? Rating.Hard : graded.rating;

    // Only feed a real judgement into FSRS. An open check we couldn't actually
    // grade (no model, no exemplar) is returned to the learner but kept out of
    // the spaced-repetition schedule. The write-back must also never block the
    // response on a transient DB error.
    if (graded.scored) {
      try {
        await this.mastery.recordCheckResult({
          userId,
          itemId: check.targetItemId,
          format: check.format,
          correct: graded.correct,
          rating,
        });
      } catch (err) {
        this.logger.error(
          `Mastery write-back failed for check ${checkId}: ${String(err)}`,
        );
      }
    }

    return {
      checkId: check.id,
      correct: graded.correct,
      correctAnswer: graded.correctAnswer,
      ...(graded.feedback ? { feedback: graded.feedback } : {}),
    };
  }

  private gradeClosed(answer: string, fixedAnswer: string, format: string) {
    // TYPED checks use Japanese normalization (wanakana + kuromoji, H.2) so that
    // romaji input and spacing differences don't cause false negatives.
    // MULTIPLE_CHOICE answers are option IDs — ASCII exact-match is correct there.
    const correct =
      format === 'TYPED'
        ? this.writingEval.exactMatch(answer, fixedAnswer)
        : exactMatch(answer, fixedAnswer);
    return {
      correct,
      correctAnswer: fixedAnswer,
      rating: undefined,
      feedback: undefined as string | undefined,
      scored: true,
    };
  }

  private async gradeOpen(prompt: string, answer: string, data: CheckData) {
    const result = await this.grading.gradeOpen({
      prompt,
      answer,
      exemplar: asString(data.exemplar),
      rubric: asString(data.rubric),
    });
    return {
      correct: result.correct,
      correctAnswer: result.exemplar,
      rating: ratingFromLabel(result.rating),
      feedback: result.feedback,
      scored: result.scored,
    };
  }
}
