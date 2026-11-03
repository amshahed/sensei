import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AssessmentItemResultDto,
  AssessmentResultDto,
  AssessmentStartDto,
  AssessmentSubmitRequest,
} from '@sensei/types';
import { exactMatch } from '../common/normalize-answer';
import { CurriculumService } from '../curriculum/curriculum.service';
import { GradingService } from '../grading/grading.service';
import { ratingFromLabel } from '../mastery/fsrs';
import { MasteryService } from '../mastery/mastery.service';
import { PrismaService } from '../prisma/prisma.service';
import { WritingEvalService } from '../writing-eval/writing-eval.service';
import {
  type AssessmentQuestion,
  assessmentQuestionFor,
  sampleAcrossGroups,
} from './assessment-question';

/** ~5 minutes of typed recall (decisions.md I.4.d.a). */
export const ASSESSMENT_SAMPLE_SIZE = 20;
/** Pass bar: ≥80% of graded answers correct (I.4.d). */
export const ASSESSMENT_PASS_THRESHOLD = 0.8;
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
  /** False when the grader couldn't actually judge it — excluded from the score + FSRS. */
  scored: boolean;
  /** AI rating, when the meaning grader produced one. */
  rating?: ReturnType<typeof ratingFromLabel>;
};

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
    private readonly grading: GradingService,
    private readonly writingEval: WritingEvalService,
    @Inject(ASSESSMENT_RANDOM) private readonly random: () => number,
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

    const byLesson = await this.chapterItems(chapter.lessons.map((l) => l.id));
    const seen = new Set<string>();
    const groups = byLesson.map((items) =>
      items.flatMap((item) => {
        if (seen.has(item.id)) return [];
        seen.add(item.id);
        const question = assessmentQuestionFor(item);
        return question ? [{ itemId: item.id, prompt: question.prompt }] : [];
      }),
    );
    const questions = sampleAcrossGroups(
      groups,
      ASSESSMENT_SAMPLE_SIZE,
      this.random,
    );
    if (questions.length === 0) {
      throw new BadRequestException(
        `Chapter ${chapterId} has nothing to assess yet.`,
      );
    }

    const kind = state.lessonsDoneChapterIds.has(chapterId) ? 'EXIT' : 'SKIP';
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });
    const attempt = await this.prisma.assessmentAttempt.create({
      data: {
        userId,
        chapterId,
        kind,
        itemIds: questions.map((q) => q.itemId),
      },
      select: { id: true },
    });

    return {
      attemptId: attempt.id,
      chapterId,
      chapterTitle: chapter.title,
      kind,
      passThreshold: ASSESSMENT_PASS_THRESHOLD,
      questions,
    };
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
    if (attempt.status !== 'IN_PROGRESS') {
      throw new ConflictException('This Assessment was already submitted.');
    }

    const answers = new Map(body.answers.map((a) => [a.itemId, a.answer]));
    const items = await this.prisma.item.findMany({
      where: { id: { in: attempt.itemIds } },
      select: ITEM_SELECT,
    });
    const itemsById = new Map(items.map((i) => [i.id, i]));

    const graded: GradedResult[] = await Promise.all(
      attempt.itemIds.map(async (itemId) => {
        const item = itemsById.get(itemId);
        const question = item ? assessmentQuestionFor(item) : null;
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
          };
        }
        return { itemId, answer, ...(await this.grade(question, answer)) };
      }),
    );

    const scored = graded.filter((g) => g.scored);
    const correct = scored.filter((g) => g.correct).length;
    const total = scored.length;
    const passed =
      total > 0 && correct / total >= ASSESSMENT_PASS_THRESHOLD - 1e-9;
    const results: AssessmentItemResultDto[] = graded.map(
      ({ itemId, prompt, answer, correct: ok, correctAnswer }) => ({
        itemId,
        prompt,
        answer,
        correct: ok,
        correctAnswer,
      }),
    );

    // Claim the attempt before any side effect, so a double submit can't
    // write FSRS reviews or marks twice.
    const now = new Date();
    const { count } = await this.prisma.assessmentAttempt.updateMany({
      where: { id: attemptId, status: 'IN_PROGRESS' },
      data: {
        status: passed ? 'PASSED' : 'FAILED',
        correctCount: correct,
        results: results as unknown as Prisma.InputJsonValue,
        submittedAt: now,
      },
    });
    if (count === 0) {
      throw new ConflictException('This Assessment was already submitted.');
    }

    const skipTestFailed = attempt.kind === 'SKIP' && !passed;
    await this.writeBack(userId, scored, { penalise: !skipTestFailed, now });

    let skippedLessonIds: string[] = [];
    if (passed) {
      await this.recordPass(userId, attempt.chapterId, attempt.itemIds, now);
    } else if (attempt.kind === 'SKIP') {
      skippedLessonIds = await this.collapseFullyTestedLessons(
        userId,
        attempt.chapterId,
        new Set(scored.filter((g) => g.correct).map((g) => g.itemId)),
      );
    }

    return {
      attemptId,
      chapterId: attempt.chapterId,
      kind: attempt.kind,
      passed,
      correct,
      total,
      passThreshold: ASSESSMENT_PASS_THRESHOLD,
      results,
      skippedLessonIds,
    };
  }

  private async grade(
    question: AssessmentQuestion,
    answer: string,
  ): Promise<Omit<GradedResult, 'itemId' | 'answer'>> {
    const base = { prompt: question.prompt, correctAnswer: question.expected };
    if (!answer) return { ...base, correct: false, scored: true };
    switch (question.check) {
      case 'romaji':
        return {
          ...base,
          correct: exactMatch(answer, question.expected),
          scored: true,
        };
      case 'reading':
        return {
          ...base,
          correct: this.writingEval.exactMatch(answer, question.expected),
          scored: true,
        };
      case 'meaning': {
        const r = await this.grading.gradeOpen({
          prompt: question.prompt,
          answer,
          exemplar: question.expected,
        });
        return {
          ...base,
          correct: r.correct,
          scored: r.scored,
          rating: ratingFromLabel(r.rating),
        };
      }
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
    for (const g of scored) {
      if (!g.correct && !penalise) continue;
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
    }
  }

  /**
   * Chapter passed: mark it, return a learner who had relocated here to their
   * furthest point, and seed the chapter's untested items as inferred mastery.
   */
  private async recordPass(
    userId: string,
    chapterId: string,
    testedItemIds: string[],
    now: Date,
  ): Promise<void> {
    await this.prisma.userChapterMark.upsert({
      where: { userId_chapterId: { userId, chapterId } },
      update: { kind: 'PASSED_ASSESSMENT', createdAt: now },
      create: { userId, chapterId, kind: 'PASSED_ASSESSMENT', createdAt: now },
    });
    await this.prisma.user.updateMany({
      where: { id: userId, currentChapterId: chapterId },
      data: { currentChapterId: null },
    });
    const tested = new Set(testedItemIds);
    const chapterItemIds = (await this.chapterTargets(chapterId)).map(
      (t) => t.itemId,
    );
    await this.mastery.seedInferred(
      userId,
      chapterItemIds.filter((id) => !tested.has(id)),
      now,
    );
  }

  /**
   * Partial pass (I.4.d.a): a lesson collapses only if every one of its
   * TARGET items was tested in this attempt and answered correctly.
   */
  private async collapseFullyTestedLessons(
    userId: string,
    chapterId: string,
    correctItemIds: ReadonlySet<string>,
  ): Promise<string[]> {
    const targets = await this.chapterTargets(chapterId);
    const byLesson = new Map<string, string[]>();
    for (const { lessonId, itemId } of targets) {
      byLesson.set(lessonId, [...(byLesson.get(lessonId) ?? []), itemId]);
    }
    const lessonIds = [...byLesson]
      .filter(([, ids]) => ids.every((id) => correctItemIds.has(id)))
      .map(([lessonId]) => lessonId);
    if (lessonIds.length > 0) {
      await this.prisma.userLessonSkip.createMany({
        data: lessonIds.map((lessonId) => ({ userId, lessonId })),
        skipDuplicates: true,
      });
    }
    return lessonIds;
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
