import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { CheckResultDto } from '@sensei/types';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from '../mastery/mastery.service';
import { GradingService } from '../grading/grading.service';
import { WritingEvalService } from '../writing-eval/writing-eval.service';
import { Rating } from 'ts-fsrs';
import { ratingFromLabel } from '../mastery/fsrs';
import { exactMatch } from '../common/normalize-answer';
import { isOpenCheck } from './check-kind';

export interface GradeOptions {
  /** Learner's "I guessed" self-report (K.1). */
  guessed?: boolean;
}

/** The persisted Check `data` shape we read for grading. */
interface CheckData {
  answer?: unknown;
  exemplar?: unknown;
  rubric?: unknown;
  explanation?: unknown;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/** Text worth showing: a string with something in it besides spaces. */
function nonBlank(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v : undefined;
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

    // Which checks are open is decided in one place, shared with the lesson
    // payload (check-kind.ts): a mis-stored multiple-choice answer stays closed.
    const isClosed = !isOpenCheck(check.format, data);

    // A check on a kana item tests that kana's own sound, so は is ha, never wa.
    const kanaTarget = check.targetItemId.startsWith('ja:kana:');
    const graded = isClosed
      ? this.gradeClosed(answer, fixedAnswer ?? '', check.format, kanaTarget)
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
    // grade still puts the item on the schedule, without a verdict, because
    // this is the only lesson path that creates a learner's FSRS row. The
    // write-back must also never block the response on a transient DB error.
    try {
      if (graded.scored) {
        await this.mastery.recordCheckResult({
          userId,
          itemId: check.targetItemId,
          format: check.format,
          correct: graded.correct,
          rating,
        });
      } else {
        await this.enterSchedule(userId, check.targetItemId);
      }
    } catch (err) {
      this.logger.error(
        `Mastery write-back failed for check ${checkId}: ${String(err)}`,
      );
    }

    // Both give the answer away, so they travel with it, never on the lesson
    // payload (B.2.b).
    const explanation = nonBlank(data.explanation);
    const answerForms =
      isClosed && check.format === 'TYPED' && fixedAnswer !== undefined
        ? this.writingEval.answerForms(fixedAnswer, {
            kanaTarget,
            prompt: check.prompt,
          })
        : null;

    return {
      checkId: check.id,
      correct: graded.correct,
      correctAnswer: graded.correctAnswer,
      scored: graded.scored,
      ...(graded.feedback ? { feedback: graded.feedback } : {}),
      ...(explanation ? { explanation } : {}),
      ...(answerForms ? { answerForms } : {}),
    };
  }

  /**
   * First contact we couldn't grade: a Hard seed, due in 2 days, so a review
   * makes the real judgement. No breadcrumb, and an existing row is left alone.
   * Seeding doesn't create the user, and this can be their first write.
   */
  private async enterSchedule(userId: string, itemId: string): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });
    await this.mastery.seedInferred(userId, [itemId]);
  }

  private gradeClosed(
    answer: string,
    fixedAnswer: string,
    format: string,
    kanaTarget: boolean,
  ) {
    // TYPED checks use Japanese normalization (wanakana + kuromoji, H.2) so that
    // romaji input and spacing differences don't cause false negatives.
    // MULTIPLE_CHOICE answers are option text, compared exactly; their position
    // never matters, since the options are shuffled on every showing (B.2.e).
    const correct =
      format === 'TYPED'
        ? this.writingEval.exactMatch(answer, fixedAnswer, { kanaTarget })
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
    // Same rule as RecallGrader: our outage isn't the learner's miss. A blank
    // answer never reaches the model, so it stays a real miss.
    const fallbackMiss =
      result.gradedBy === 'fallback' &&
      !result.correct &&
      answer.trim().length > 0;
    return {
      correct: result.correct,
      correctAnswer: result.exemplar,
      rating: ratingFromLabel(result.rating),
      // Only the model's own comment on what the learner wrote is shown. The
      // fallback's lines ("the expected answer was…") aren't one (B.2.d).
      feedback: result.gradedBy === 'ai' ? result.feedback : undefined,
      scored: result.scored && !fallbackMiss,
    };
  }
}
