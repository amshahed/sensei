import {
  BadRequestException,
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AssessmentItemResultDto,
  AssessmentKind,
  AssessmentResultDto,
  AssessmentStartDto,
  AssessmentSubmitRequest,
  ItemType,
} from '@sensei/types';
import type { Grade } from 'ts-fsrs';
import { mapLimit } from '../common/map-limit';
import { CurriculumService } from '../curriculum/curriculum.service';
import { MasteryService } from '../mastery/mastery.service';
import { PrismaService } from '../prisma/prisma.service';
import { RecallGraderService } from '../recall/recall-grader.service';
import { StreakService } from '../streak/streak.service';
import { mayInferMastery } from '../recall/learner-surface';
import {
  type RecallQuestion,
  recallQuestionFor,
} from '../recall/recall-question';
import { sampleAcrossGroups } from './assessment-sample';
import { assessmentVerdict } from './assessment-verdict';

/** ~5 minutes of typed recall (decisions.md I.4.d.a). */
export const ASSESSMENT_SAMPLE_SIZE = 20;
/**
 * Pass bar: ≥80% of all the questions asked, graded right (I.4.d, I.4.d.b).
 * An answer the grader couldn't judge never helps a pass.
 */
export const ASSESSMENT_PASS_THRESHOLD = 0.8;
/** An attempt must be submitted within this long of starting it. */
export const ASSESSMENT_TTL_MS = 60 * 60 * 1000;
/** Max concurrent AI grading calls / FSRS writes per submit. */
const CONCURRENCY = 4;
/** Injection token for the sampler's randomness (deterministic in tests). */
export const ASSESSMENT_RANDOM = Symbol('ASSESSMENT_RANDOM');

const ITEM_SELECT = {
  id: true,
  type: true,
  display: true,
  reading: true,
  meaning: true,
  data: true,
} satisfies Prisma.ItemSelect;

type GradedResult = AssessmentItemResultDto & {
  /** AI rating, when the meaning grader produced one. */
  rating?: Grade;
  /**
   * False when the item can no longer be asked (deleted or changed since the
   * attempt started): the question counts neither way (I.4.d.b point 5).
   * Internal only, never stored or sent.
   */
  asked: boolean;
};

/** One stored answer. Attempts submitted before B.2.g carry no `scored`. */
type StoredItem = Omit<AssessmentItemResultDto, 'scored'> & {
  scored?: boolean;
};

/** What `AssessmentAttempt.results` stores, so a repeat submit can replay it. */
type StoredResults = {
  items: StoredItem[];
  total: number;
  skippedLessonIds: string[];
};

type Tx = Prisma.TransactionClient;

/**
 * Chapter Assessment engine (I.4.d.a): one engine for both the skip-test
 * (taken before a chapter's lessons are done) and the exit Assessment (after).
 * Questions are generated per item and sampled across the chapter's lessons;
 * the learner submits every answer once and gets the score at the end.
 */
@Injectable()
export class AssessmentsService {
  private readonly logger = new Logger(AssessmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculum: CurriculumService,
    private readonly mastery: MasteryService,
    private readonly recall: RecallGraderService,
    @Inject(ASSESSMENT_RANDOM) private readonly random: () => number,
    private readonly streak: StreakService,
  ) {}

  async start(userId: string, chapterId: string): Promise<AssessmentStartDto> {
    const { modules, state } = await this.curriculum.getState(userId);
    const chapter = modules
      .flatMap((m) => m.chapters)
      .find((c) => c.id === chapterId);
    if (!chapter) {
      throw new NotFoundException(`Chapter not found: ${chapterId}`);
    }
    if (!state.chapterActions.get(chapterId)?.assessment) {
      throw new BadRequestException(
        `The Assessment for chapter ${chapterId} isn't available: it is locked or already passed.`,
      );
    }
    const kind: AssessmentKind = state.lessonsDoneChapterIds.has(chapterId)
      ? 'EXIT'
      : 'SKIP';

    const byLesson = await this.chapterItems(chapter.lessons.map((l) => l.id));
    const seen = new Set<string>();
    const groups = byLesson.map((items) =>
      items.flatMap((item) => {
        if (seen.has(item.id)) return [];
        seen.add(item.id);
        const question = recallQuestionFor(item);
        return question ? [{ itemId: item.id, prompt: question.prompt }] : [];
      }),
    );
    const questions = sampleAcrossGroups(
      groups,
      ASSESSMENT_SAMPLE_SIZE,
      this.random,
    );

    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });
    const base = {
      chapterId,
      chapterTitle: chapter.title,
      kind,
      passThreshold: ASSESSMENT_PASS_THRESHOLD,
    };

    if (questions.length === 0) {
      if (kind === 'SKIP') {
        throw new BadRequestException(
          `Chapter ${chapterId} has nothing to test yet — start its lessons instead.`,
        );
      }
      // Lessons done, nothing assessable: the exit gate can't be taken, so it
      // must not block the learner — the chapter passes.
      const attemptId = await this.prisma.$transaction(async (tx) => {
        const stored: StoredResults = {
          items: [],
          total: 0,
          skippedLessonIds: [],
        };
        const { id } = await tx.assessmentAttempt.create({
          data: {
            userId,
            chapterId,
            kind,
            itemIds: [],
            status: 'PASSED',
            correctCount: 0,
            results: stored,
            submittedAt: new Date(),
          },
          select: { id: true },
        });
        await this.markPassed(tx, userId, chapterId, new Date());
        return id;
      });
      return { ...base, attemptId, questions: [], autoPassed: true };
    }

    const attempt = await this.prisma.assessmentAttempt.create({
      data: {
        userId,
        chapterId,
        kind,
        itemIds: questions.map((q) => q.itemId),
      },
      select: { id: true },
    });
    return { ...base, attemptId: attempt.id, questions, autoPassed: false };
  }

  async submit(
    userId: string,
    attemptId: string,
    body: AssessmentSubmitRequest,
  ): Promise<AssessmentResultDto> {
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt || attempt.userId !== userId) {
      throw new NotFoundException(`Assessment attempt not found: ${attemptId}`);
    }
    // Idempotent: a repeat submit (double tap, lost response) replays the
    // stored result instead of failing.
    if (attempt.status !== 'IN_PROGRESS') return storedResult(attempt);

    const now = new Date();
    if (now.getTime() - attempt.createdAt.getTime() > ASSESSMENT_TTL_MS) {
      throw new GoneException('This Assessment has expired — start a new one.');
    }
    const { state } = await this.curriculum.getState(userId);
    if (!state.chapterActions.get(attempt.chapterId)?.assessment) {
      throw new ConflictException(
        'This chapter no longer takes an Assessment (it was passed meanwhile).',
      );
    }

    const answers = new Map(body.answers.map((a) => [a.itemId, a.answer]));
    const items = await this.prisma.item.findMany({
      where: { id: { in: attempt.itemIds } },
      select: ITEM_SELECT,
    });
    const itemsById = new Map(items.map((i) => [i.id, i]));

    const graded = await mapLimit(
      attempt.itemIds,
      CONCURRENCY,
      async (itemId): Promise<GradedResult> => {
        const item = itemsById.get(itemId);
        const question = item ? recallQuestionFor(item) : null;
        const answer = (answers.get(itemId) ?? '').trim();
        if (!question) {
          // The item was deleted or changed since the attempt started.
          return {
            itemId,
            prompt: '',
            answer,
            correct: false,
            correctAnswer: '',
            scored: false,
            asked: false,
          };
        }
        return {
          itemId,
          answer,
          asked: true,
          ...(await this.grade(question, answer)),
        };
      },
    );

    const asked = graded.filter((g) => g.asked);
    if (asked.length === 0) {
      // Every sampled item vanished (a republish mid-attempt): nothing can
      // decide this attempt, so don't hold it open. Starting again resamples.
      throw new GoneException(
        "This test's questions have changed — start a new one.",
      );
    }
    const scored = asked.filter((g) => g.scored);
    const total = scored.length;
    const correct = scored.filter((g) => g.correct).length;
    const ungraded = asked.length - total;
    const verdict = assessmentVerdict(
      { right: correct, ungraded, asked: asked.length },
      ASSESSMENT_PASS_THRESHOLD,
    );
    if (verdict === 'UNDECIDED') {
      // The answers the grader couldn't judge (an outage) could still change
      // the outcome (I.4.d.b). Write nothing and leave the attempt open: a
      // resubmit grades every answer again (I.4.d.c). Never logs answers.
      this.logger.warn(
        `ASSESSMENT_UNDECIDED attempt=${attemptId} kind=${attempt.kind} asked=${asked.length} right=${correct} ungraded=${ungraded}`,
      );
      throw new ServiceUnavailableException(
        'Grading is unavailable right now — please submit again shortly.',
      );
    }
    const passed = verdict === 'PASSED';
    const skippedLessonIds =
      !passed && attempt.kind === 'SKIP'
        ? await this.fullyTestedLessons(
            attempt.chapterId,
            new Set(scored.filter((g) => g.correct).map((g) => g.itemId)),
          )
        : [];
    const stored: StoredResults = {
      // Only the DTO's fields are stored (no rating or feedback). Typed as the
      // DTO, so a new required field can't be left out silently.
      items: graded.map(
        (g): AssessmentItemResultDto => ({
          itemId: g.itemId,
          prompt: g.prompt,
          answer: g.answer,
          correct: g.correct,
          correctAnswer: g.correctAnswer,
          scored: g.scored,
        }),
      ),
      total,
      skippedLessonIds,
    };

    // Claim the attempt and record the chapter outcome atomically, so a
    // concurrent submit can't double-apply and a failure can't leave a
    // PASSED attempt without its mark.
    const claimed = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.assessmentAttempt.updateMany({
        where: { id: attemptId, status: 'IN_PROGRESS' },
        data: {
          status: passed ? 'PASSED' : 'FAILED',
          correctCount: correct,
          results: stored,
          submittedAt: now,
        },
      });
      if (count === 0) return false;
      if (passed) await this.markPassed(tx, userId, attempt.chapterId, now);
      if (skippedLessonIds.length > 0) {
        await tx.userLessonSkip.createMany({
          data: skippedLessonIds.map((lessonId) => ({ userId, lessonId })),
          skipDuplicates: true,
        });
      }
      return true;
    });
    if (!claimed) {
      // A concurrent submit won the claim — replay its result.
      const winner = await this.prisma.assessmentAttempt.findUnique({
        where: { id: attemptId },
      });
      if (winner && winner.status !== 'IN_PROGRESS') {
        return storedResult(winner);
      }
      throw new ConflictException('This Assessment was already submitted.');
    }

    // FSRS is best-effort after the outcome is safely recorded: a failed
    // write is logged and self-corrects through later reviews.
    const skipTestFailed = attempt.kind === 'SKIP' && !passed;
    const noEvidence =
      attempt.kind === 'SKIP' && passed
        ? await this.missedKanjiWithoutEvidence(userId, scored, itemsById)
        : new Set<string>();
    await this.writeBack(
      userId,
      scored.filter((g) => !noEvidence.has(g.itemId)),
      { penalise: !skipTestFailed, now },
    );
    if (passed) {
      // Only graded answers count as tested: an ungraded one is seeded like
      // an item the test didn't ask about (I.4.d.b point 4).
      await this.seedUntested(
        userId,
        attempt.chapterId,
        scored.map((g) => g.itemId),
        attempt.kind,
        now,
      );
    }
    // Answering the Assessment was real effort (K.3.f) — first submit only.
    await this.streak.record(
      userId,
      { kind: 'answers', count: stored.items.length },
      now,
    );

    return {
      attemptId,
      chapterId: attempt.chapterId,
      kind: attempt.kind,
      passed,
      correct,
      total,
      passThreshold: ASSESSMENT_PASS_THRESHOLD,
      results: stored.items.map(toResult),
      skippedLessonIds,
    };
  }

  private async grade(
    question: RecallQuestion,
    answer: string,
  ): Promise<Omit<GradedResult, 'itemId' | 'answer' | 'asked'>> {
    const graded = await this.recall.grade(question, answer);
    return {
      prompt: question.prompt,
      correctAnswer: question.expected,
      ...graded,
    };
  }

  /**
   * Kanji the learner missed on a passed skip-test and has no mastery row for
   * (G.4.d): they neither studied it nor answered it correctly, so a miss
   * must not put it into Reviews. A row is evidence: a lesson Check or an
   * earlier correct test answer (G.4.e). If the lookup fails, every missed
   * kanji is left out: that loses one Again, where throwing would turn an
   * already recorded result into a 500.
   */
  private async missedKanjiWithoutEvidence(
    userId: string,
    scored: GradedResult[],
    itemsById: ReadonlyMap<string, { type: ItemType }>,
  ): Promise<Set<string>> {
    const missed = scored
      .filter((g) => {
        const item = itemsById.get(g.itemId);
        return !g.correct && item !== undefined && !mayInferMastery(item);
      })
      .map((g) => g.itemId);
    if (missed.length === 0) return new Set();
    try {
      const rows = await this.prisma.itemMasteryState.findMany({
        where: { userId, itemId: { in: missed } },
        select: { itemId: true },
      });
      const known = new Set(rows.map((r) => r.itemId));
      return new Set(missed.filter((id) => !known.has(id)));
    } catch (err) {
      this.logger.error(
        `Evidence lookup failed, leaving out missed kanji: ${String(err)}`,
      );
      return new Set(missed);
    }
  }

  /**
   * FSRS: correct answers count as normal reviews; wrong ones as Again —
   * except on a failed skip-test, which carries no penalty (I.4.d).
   */
  private async writeBack(
    userId: string,
    scored: GradedResult[],
    { penalise, now }: { penalise: boolean; now: Date },
  ): Promise<void> {
    const writes = scored.filter((g) => g.correct || penalise);
    await mapLimit(writes, CONCURRENCY, async (g) => {
      try {
        await this.mastery.recordCheckResult({
          userId,
          itemId: g.itemId,
          format: 'TYPED',
          correct: g.correct,
          rating: g.rating,
          reviewedAt: now,
        });
      } catch (err) {
        this.logger.error(
          `Mastery write-back failed for item ${g.itemId}: ${String(err)}`,
        );
      }
    });
  }

  /**
   * Chapter passed: mark it and return a learner who had relocated here to
   * their furthest point.
   */
  private async markPassed(
    tx: Tx,
    userId: string,
    chapterId: string,
    now: Date,
  ): Promise<void> {
    await tx.userChapterMark.upsert({
      where: { userId_chapterId: { userId, chapterId } },
      update: { kind: 'PASSED_ASSESSMENT', createdAt: now },
      create: { userId, chapterId, kind: 'PASSED_ASSESSMENT', createdAt: now },
    });
    await tx.user.updateMany({
      where: { id: userId, currentChapterId: chapterId },
      data: { currentChapterId: null },
    });
  }

  /**
   * Seed the passed chapter's untested items as inferred mastery (I.4.c). An
   * item is tested only if its answer was graded: one the grader couldn't
   * judge is seeded like one the test never asked (I.4.d.b). On a skip-test
   * that excludes kanji, which it says nothing about (G.4.d). An Exit
   * Assessment follows the chapter's lessons, so it keeps them.
   */
  private async seedUntested(
    userId: string,
    chapterId: string,
    gradedItemIds: string[],
    kind: AssessmentKind,
    now: Date,
  ): Promise<void> {
    try {
      const tested = new Set(gradedItemIds);
      // Only items Reviews can actually quiz — a seeded non-quizzable item
      // would sit due forever with nothing to ask.
      const rows = await this.prisma.lessonItem.findMany({
        where: { role: 'TARGET', lesson: { chapterId } },
        select: { item: { select: ITEM_SELECT } },
      });
      const untested = rows
        .map((r) => r.item)
        .filter(
          (item) =>
            !tested.has(item.id) &&
            (kind === 'EXIT' || mayInferMastery(item)) &&
            recallQuestionFor(item),
        )
        .map((item) => item.id);
      await this.mastery.seedInferred(userId, untested, now);
    } catch (err) {
      this.logger.error(
        `Inferred-mastery seeding failed for chapter ${chapterId}: ${String(err)}`,
      );
    }
  }

  /**
   * Partial pass (I.4.d.a): a lesson collapses only if every one of its
   * TARGET items was tested in this attempt and answered correctly.
   */
  private async fullyTestedLessons(
    chapterId: string,
    correctItemIds: ReadonlySet<string>,
  ): Promise<string[]> {
    const byLesson = new Map<string, string[]>();
    for (const { lessonId, itemId } of await this.chapterTargets(chapterId)) {
      byLesson.set(lessonId, [...(byLesson.get(lessonId) ?? []), itemId]);
    }
    return [...byLesson]
      .filter(([, ids]) => ids.every((id) => correctItemIds.has(id)))
      .map(([lessonId]) => lessonId);
  }

  /** TARGET items per lesson, lessons in the given order. */
  private async chapterItems(lessonIds: string[]) {
    const rows = await this.prisma.lessonItem.findMany({
      where: { role: 'TARGET', lessonId: { in: lessonIds } },
      orderBy: { position: 'asc' },
      select: { lessonId: true, item: { select: ITEM_SELECT } },
    });
    return lessonIds.map((id) =>
      rows.filter((r) => r.lessonId === id).map((r) => r.item),
    );
  }

  private chapterTargets(chapterId: string) {
    return this.prisma.lessonItem.findMany({
      where: { role: 'TARGET', lesson: { chapterId } },
      select: { lessonId: true, itemId: true },
    });
  }
}

/**
 * A stored answer on the wire. One stored before B.2.g can't tell an ungraded
 * answer from a miss, so it replays as it was shown then: graded.
 */
function toResult(item: StoredItem): AssessmentItemResultDto {
  return { ...item, scored: item.scored ?? true };
}

/** Rebuild the result of an already-submitted attempt from what it stored. */
function storedResult(attempt: {
  id: string;
  chapterId: string;
  kind: AssessmentKind;
  status: string;
  correctCount: number | null;
  results: Prisma.JsonValue | null;
}): AssessmentResultDto {
  const stored = (attempt.results ?? {}) as Partial<StoredResults>;
  return {
    attemptId: attempt.id,
    chapterId: attempt.chapterId,
    kind: attempt.kind,
    passed: attempt.status === 'PASSED',
    correct: attempt.correctCount ?? 0,
    total: stored.total ?? 0,
    passThreshold: ASSESSMENT_PASS_THRESHOLD,
    results: (stored.items ?? []).map(toResult),
    skippedLessonIds: stored.skippedLessonIds ?? [],
  };
}
