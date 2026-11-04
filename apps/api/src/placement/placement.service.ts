import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  PlacementAnswerDto,
  PlacementAnswerRequest,
  PlacementResultDto,
  PlacementStartDto,
} from '@sensei/types';
import { MasteryService } from '../mastery/mastery.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  RECALLABLE_ITEM_SELECT,
  recallQuestionFor,
} from '../recall/recall-question';
import {
  buildPools,
  type PlacementChapter,
  type PlacementQuestion,
  placementOutcome,
  placementTierFor,
  samplePlacement,
  toQuestionDto,
} from './placement-questions';

/** Foundation is Japanese-only today (CC.1: modules are language-scoped). */
const LANGUAGE = 'ja';
/** Injection token for sampling / choice-order randomness (deterministic in tests). */
export const PLACEMENT_RANDOM = Symbol('PLACEMENT_RANDOM');

type StoredAnswer = { itemId: string; correct: boolean };
type Attempt = Prisma.PlacementAttemptGetPayload<object>;
type Tx = Prisma.TransactionClient;

/**
 * Signup placement quiz (I.3.d, I.4.f): multiple-choice questions sampled in
 * course order, answered one at a time, ending at the first miss. The miss
 * decides where the learner starts; earlier chapters are marked
 * SKIPPED_VIA_PLACEMENT, correct answers seed FSRS high and untested items of
 * skipped chapters seed moderate.
 */
@Injectable()
export class PlacementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
    @Inject(PLACEMENT_RANDOM) private readonly random: () => number,
  ) {}

  /** Start the quiz, resume an unfinished one, or (once over) return its result. */
  async start(userId: string): Promise<PlacementStartDto> {
    const tier = await this.tierFor(userId);
    let attempt = await this.prisma.placementAttempt.findUnique({
      where: { userId },
    });
    if (!attempt) {
      await this.assertNew(userId);
      const questions = await this.buildQuestions(tier);
      try {
        attempt = await this.prisma.placementAttempt.create({
          data: {
            userId,
            tier,
            questions: questions as unknown as Prisma.InputJsonValue,
          },
        });
      } catch (err) {
        // A concurrent start won the one-attempt-per-learner race: resume it.
        if (!isUniqueViolation(err)) throw err;
        attempt = await this.prisma.placementAttempt.findUniqueOrThrow({
          where: { userId },
        });
      }
    }
    // Nothing to ask (no askable items published): place at the start. Done
    // on every start, so an attempt whose first finish failed can't strand
    // the learner on an empty quiz.
    if (attempt.status === 'IN_PROGRESS' && questionsOf(attempt).length === 0) {
      attempt = await this.finish(userId, attempt, []);
    }

    const questions = questionsOf(attempt);
    return {
      attemptId: attempt.id,
      tier: attempt.tier,
      questions: questions.map(toQuestionDto),
      answered: attempt.answered,
      result:
        attempt.status === 'IN_PROGRESS' ? null : await this.resultOf(attempt),
    };
  }

  /** Answer the next question. A miss (or "I don't know") ends the quiz. */
  async answer(
    userId: string,
    attemptId: string,
    { itemId, choices }: PlacementAnswerRequest,
  ): Promise<PlacementAnswerDto> {
    const attempt = await this.prisma.placementAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt || attempt.userId !== userId) {
      throw new NotFoundException(`Placement attempt not found: ${attemptId}`);
    }
    const questions = questionsOf(attempt);
    const answers = answersOf(attempt);

    // A retried request for an answer we already took: replay the outcome.
    if (answers.some((a) => a.itemId === itemId)) {
      return this.stateOf(attempt);
    }
    if (attempt.status !== 'IN_PROGRESS') {
      throw new ConflictException('Placement is already done.');
    }
    const question = questions[attempt.answered];
    if (!question || question.itemId !== itemId) {
      throw new BadRequestException('Answer the placement questions in order.');
    }
    if (
      choices !== null &&
      (choices.length !== question.parts.length ||
        choices.some((c, i) => !question.parts[i].choices.includes(c)))
    ) {
      throw new BadRequestException(
        `Pick one of the offered choices for each of the ${question.parts.length} part(s), or null for "I don't know".`,
      );
    }

    const correct =
      choices !== null &&
      question.parts.every((p, i) => choices[i] === p.answer);
    const next = [...answers, { itemId, correct }];
    const done = !correct || next.length === questions.length;
    const finished = done
      ? await this.finish(userId, attempt, next)
      : await this.record(attempt, next);
    return this.stateOf(finished);
  }

  /** "Skip — start from the beginning": only before the first answer. */
  async skip(userId: string): Promise<PlacementResultDto> {
    const tier = await this.tierFor(userId);
    const attempt = await this.prisma.placementAttempt.findUnique({
      where: { userId },
    });
    if (attempt && attempt.status !== 'IN_PROGRESS') {
      if (attempt.status === 'SKIPPED') return this.resultOf(attempt);
      throw new ConflictException('Placement is already done.');
    }
    if (!attempt) await this.assertNew(userId);
    if (attempt && attempt.answered > 0) {
      throw new ConflictException(
        `Placement has started: answer "I don't know" to finish it here.`,
      );
    }
    const start = await this.firstChapterId();
    const data = {
      status: 'SKIPPED' as const,
      startChapterId: start,
      completedAt: new Date(),
    };
    const skipped = attempt
      ? await this.claim(this.prisma, attempt, data)
      : await this.prisma.placementAttempt
          .create({ data: { userId, tier, questions: [], ...data } })
          .catch((err: unknown) => {
            if (!isUniqueViolation(err)) throw err;
            throw new ConflictException('Placement was started meanwhile.');
          });
    return this.resultOf(skipped);
  }

  // ── internals ────────────────────────────────────────────────────────────

  /** The learner's placement tier; 400 unless the survey says they need one. */
  private async tierFor(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { intakeCompletedAt: true, priorExperience: true },
    });
    if (!user?.intakeCompletedAt) {
      throw new BadRequestException('Finish the signup survey first.');
    }
    const tier = placementTierFor(user.priorExperience);
    if (!tier) {
      throw new BadRequestException(
        'No placement needed: beginners start at the first lesson.',
      );
    }
    return tier;
  }

  /**
   * Placement is part of signup (I.3.d): a learner who already has progress
   * (from before onboarding existed) isn't placed on top of it.
   */
  private async assertNew(userId: string): Promise<void> {
    if (await learnerHasProgress(this.prisma, userId)) {
      throw new BadRequestException(
        'Placement is for new learners — you have already started lessons.',
      );
    }
  }

  /** Sample the quiz from the published curriculum, in course order. */
  private async buildQuestions(
    tier: 'KANA' | 'FULL',
  ): Promise<PlacementQuestion[]> {
    const [rows, kanaPool, wordPool] = await Promise.all([
      this.prisma.lessonItem.findMany({
        where: {
          role: 'TARGET',
          lesson: { chapter: { module: { language: LANGUAGE } } },
        },
        select: {
          position: true,
          item: { select: RECALLABLE_ITEM_SELECT },
          lesson: {
            select: {
              position: true,
              chapter: {
                select: {
                  id: true,
                  position: true,
                  module: { select: { position: true } },
                },
              },
            },
          },
        },
      }),
      // Distractor pools. Only kana need `data` (script, rōmaji); vocab and
      // kanji pools are built from display / reading / meaning alone.
      this.prisma.item.findMany({
        where: { language: LANGUAGE, type: 'KANA' },
        select: RECALLABLE_ITEM_SELECT,
      }),
      this.prisma.item.findMany({
        where: {
          language: LANGUAGE,
          // The kana tier asks kana only: no word pool needed.
          type: { in: tier === 'FULL' ? ['VOCAB', 'KANJI'] : [] },
        },
        select: {
          id: true,
          type: true,
          display: true,
          reading: true,
          meaning: true,
        },
      }),
    ]);

    // Course order: module → chapter → lesson → item position. Each item
    // belongs to the first chapter that teaches it.
    rows.sort(
      (a, b) =>
        a.lesson.chapter.module.position - b.lesson.chapter.module.position ||
        a.lesson.chapter.position - b.lesson.chapter.position ||
        a.lesson.position - b.lesson.position ||
        a.position - b.position,
    );
    const chapters: PlacementChapter[] = [];
    const seen = new Set<string>();
    for (const { item, lesson } of rows) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      const id = lesson.chapter.id;
      const last = chapters[chapters.length - 1];
      if (last?.id === id) last.items.push(item);
      else chapters.push({ id, items: [item] });
    }
    const pools = buildPools([
      ...kanaPool,
      ...wordPool.map((i) => ({ ...i, data: null })),
    ]);
    return samplePlacement(chapters, tier, pools, this.random);
  }

  /** Record a correct, non-final answer (compare-and-set on `answered`). */
  private record(attempt: Attempt, answers: StoredAnswer[]) {
    return this.claim(this.prisma, attempt, {
      answers: answers,
      answered: answers.length,
    });
  }

  /**
   * End the quiz: apply the first-miss rule, mark skipped chapters, seed FSRS
   * — all in one transaction with the final answer, so a retry can't apply
   * it twice and a failure applies none of it.
   */
  private async finish(
    userId: string,
    attempt: Attempt,
    answers: StoredAnswer[],
  ): Promise<Attempt> {
    const questions = questionsOf(attempt);
    const chapterIds = await this.chapterIds();
    const { startChapterId, skippedChapterIds } = placementOutcome(
      chapterIds,
      questions,
      answers,
    );
    const now = new Date();
    // Evidence is seeded only for skipped chapters: from the start chapter on,
    // items are taught normally (I.4.f) and their lessons record them.
    const skipped = new Set(skippedChapterIds);
    const testedCorrect = answers
      .filter((a, i) => a.correct && skipped.has(questions[i].chapterId))
      .map((a) => a.itemId);
    const untested = await this.inferable(
      skippedChapterIds,
      answers.map((a) => a.itemId),
    );

    return this.prisma.$transaction(async (tx) => {
      const done = await this.claim(tx, attempt, {
        answers: answers,
        answered: answers.length,
        status: 'COMPLETED',
        startChapterId,
        completedAt: now,
      });
      // Never downgrade a chapter the learner already passed.
      await tx.userChapterMark.createMany({
        data: skippedChapterIds.map((chapterId) => ({
          userId,
          chapterId,
          kind: 'SKIPPED_VIA_PLACEMENT' as const,
        })),
        skipDuplicates: true,
      });
      await this.mastery.seedTested(userId, testedCorrect, now, tx);
      await this.mastery.seedInferred(userId, untested, now, tx);
      return done;
    });
  }

  /**
   * Update an in-progress attempt, guarded on the answer count it was read
   * with — so two concurrent submits of the same question can't both land.
   */
  private async claim(
    db: Tx,
    attempt: Attempt,
    data: Prisma.PlacementAttemptUpdateManyMutationInput,
  ): Promise<Attempt> {
    const { count } = await db.placementAttempt.updateMany({
      where: {
        id: attempt.id,
        status: 'IN_PROGRESS',
        answered: attempt.answered,
      },
      data,
    });
    if (count === 0) {
      throw new ConflictException(
        'This placement question was answered meanwhile — reload and continue.',
      );
    }
    return db.placementAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
  }

  /** Untested, quizzable items taught in the skipped chapters (seeded moderate). */
  private async inferable(
    chapterIds: string[],
    tested: string[],
  ): Promise<string[]> {
    if (chapterIds.length === 0) return [];
    const rows = await this.prisma.lessonItem.findMany({
      where: { role: 'TARGET', lesson: { chapterId: { in: chapterIds } } },
      select: { item: { select: RECALLABLE_ITEM_SELECT } },
    });
    const skip = new Set(tested);
    return [
      ...new Set(
        rows
          .map((r) => r.item)
          .filter((i) => !skip.has(i.id) && recallQuestionFor(i) !== null)
          .map((i) => i.id),
      ),
    ];
  }

  /** Chapters with lessons, in course order. */
  private async chapterIds(): Promise<string[]> {
    const chapters = await this.prisma.chapter.findMany({
      where: { module: { language: LANGUAGE }, lessons: { some: {} } },
      orderBy: [{ module: { position: 'asc' } }, { position: 'asc' }],
      select: { id: true },
    });
    return chapters.map((c) => c.id);
  }

  private async firstChapterId(): Promise<string | null> {
    return (await this.chapterIds())[0] ?? null;
  }

  private async stateOf(attempt: Attempt): Promise<PlacementAnswerDto> {
    const done = attempt.status !== 'IN_PROGRESS';
    return { done, result: done ? await this.resultOf(attempt) : null };
  }

  private async resultOf(attempt: Attempt): Promise<PlacementResultDto> {
    const [chapter, skippedChapterCount] = await Promise.all([
      attempt.startChapterId
        ? this.prisma.chapter.findUnique({
            where: { id: attempt.startChapterId },
            select: { id: true, title: true },
          })
        : null,
      this.prisma.userChapterMark.count({
        where: { userId: attempt.userId, kind: 'SKIPPED_VIA_PLACEMENT' },
      }),
    ]);
    return {
      status: attempt.status === 'SKIPPED' ? 'SKIPPED' : 'COMPLETED',
      startChapter: chapter,
      skippedChapterCount,
      answered: attempt.answered,
    };
  }
}

/** Any lesson completed or chapter passed — the learner is past signup. */
export async function learnerHasProgress(
  prisma: PrismaService,
  userId: string,
): Promise<boolean> {
  const [completions, marks] = await Promise.all([
    prisma.lessonCompletion.findMany({
      where: { userId },
      select: { lessonId: true },
      take: 1,
    }),
    prisma.userChapterMark.findMany({
      where: { userId },
      select: { chapterId: true },
      take: 1,
    }),
  ]);
  return completions.length > 0 || marks.length > 0;
}

const questionsOf = (a: Attempt) =>
  a.questions as unknown as PlacementQuestion[];
const answersOf = (a: Attempt) => a.answers as unknown as StoredAnswer[];

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}
