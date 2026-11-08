import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ItemType,
  ItemTypeCounts,
  PracticeAnswerRequest,
  PracticeResultDto,
  PracticeScopesDto,
  PracticeSessionDto,
  PracticeStartRequest,
} from '@sensei/types';
import { MasteryService, rankWeakest } from '../mastery/mastery.service';
import { PrismaService } from '../prisma/prisma.service';
import { StreakService } from '../streak/streak.service';
import {
  RecallGraderService,
  recallResult,
} from '../recall/recall-grader.service';
import { learnerSurface } from '../recall/learner-surface';
import {
  RECALLABLE_ITEM_SELECT,
  recallQuestionFor,
} from '../recall/recall-question';

/** Foundation is Japanese-only today (CC.1: modules are language-scoped). */
const LANGUAGE = 'ja';
/** Items per drill (J.1.f): a little above the G.4 review cap, since drilling is opt-in. */
export const PRACTICE_SESSION_SIZE = 20;

const zeroCounts = (): ItemTypeCounts => ({
  KANA: 0,
  VOCAB: 0,
  KANJI: 0,
  GRAMMAR: 0,
});

/**
 * Practice Mode (J.1): learner-directed drill over items they have already
 * learned (J.1.e), weakest first (J.1.b), scored exactly like a review
 * (J.1.c) — but only the first answer to an item in a session counts toward
 * FSRS. Never advances the curriculum (J.1.a): nothing here writes lesson
 * completions or chapter marks.
 */
@Injectable()
export class PracticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
    private readonly recall: RecallGraderService,
    private readonly streak: StreakService,
  ) {}

  /** What can be drilled: learned, quizzable item counts per module / chapter / type. */
  async scopes(userId: string): Promise<PracticeScopesDto> {
    const learned = await this.mastery.learnedQuizzable(userId);
    const learnedById = new Map(learned.map((s) => [s.item.id, s.item.type]));

    const rows = await this.prisma.lessonItem.findMany({
      where: {
        role: 'TARGET',
        itemId: { in: [...learnedById.keys()] },
        lesson: { chapter: { module: { language: LANGUAGE } } },
      },
      select: {
        itemId: true,
        lesson: {
          select: {
            chapter: {
              select: {
                id: true,
                title: true,
                position: true,
                module: { select: { id: true, title: true, position: true } },
              },
            },
          },
        },
      },
    });

    type ChapterAgg = {
      id: string;
      title: string;
      position: number;
      items: Set<string>;
    };
    const modules = new Map<
      string,
      {
        id: string;
        title: string;
        position: number;
        items: Set<string>;
        chapters: Map<string, ChapterAgg>;
      }
    >();
    for (const { itemId, lesson } of rows) {
      const { module: m, ...c } = lesson.chapter;
      const mod =
        modules.get(m.id) ??
        modules
          .set(m.id, { ...m, items: new Set(), chapters: new Map() })
          .get(m.id)!;
      const ch =
        mod.chapters.get(c.id) ??
        mod.chapters.set(c.id, { ...c, items: new Set() }).get(c.id)!;
      mod.items.add(itemId);
      ch.items.add(itemId);
    }

    const count = (ids: Iterable<string>) => {
      const out = zeroCounts();
      for (const id of ids) {
        const type = learnedById.get(id);
        if (type) out[type]++;
      }
      return out;
    };
    const byPosition = <T extends { position: number }>(a: T, b: T) =>
      a.position - b.position;

    return {
      learned: count(learnedById.keys()),
      modules: [...modules.values()].sort(byPosition).map((m) => ({
        id: m.id,
        title: m.title,
        learned: count(m.items),
        chapters: [...m.chapters.values()].sort(byPosition).map((c) => ({
          id: c.id,
          title: c.title,
          learned: count(c.items),
        })),
      })),
    };
  }

  /** Start a drill: learned items in scope, weakest first, capped. */
  async start(
    userId: string,
    req: PracticeStartRequest,
    now: Date = new Date(),
  ): Promise<PracticeSessionDto> {
    const scopeItemIds = await this.scopeItemIds(req.scope);
    const types = req.types?.length ? new Set<ItemType>(req.types) : null;
    const learned = await this.mastery.learnedQuizzable(userId, scopeItemIds);

    // J.1.b: always the G.4 order — lowest retention, then weakest modality.
    const ranked = rankWeakest(
      learned.filter((s) => !types || types.has(s.item.type)),
      now,
    ).slice(0, PRACTICE_SESSION_SIZE);

    if (ranked.length === 0) return { sessionId: null, items: [] };

    const items = ranked.map(({ state: { item } }) => ({
      itemId: item.id,
      type: item.type,
      display: learnerSurface(item),
      prompt: recallQuestionFor(item)!.prompt,
    }));
    const session = await this.prisma.practiceSession.create({
      data: {
        userId,
        scope: {
          ...req.scope,
          ...(types ? { types: [...types] } : {}),
        },
        itemIds: items.map((i) => i.itemId),
      },
      select: { id: true },
    });
    return { sessionId: session.id, items };
  }

  /** Grade one answer like a review; only the session's first scored answer per item counts. */
  async answer(
    userId: string,
    sessionId: string,
    { itemId, answer }: PracticeAnswerRequest,
  ): Promise<PracticeResultDto> {
    const session = await this.prisma.practiceSession.findUnique({
      where: { id: sessionId },
      select: { userId: true, itemIds: true },
    });
    if (!session || session.userId !== userId) {
      throw new NotFoundException(`Practice session not found: ${sessionId}`);
    }
    if (!session.itemIds.includes(itemId)) {
      throw new BadRequestException(
        `Item ${itemId} isn't part of this practice session.`,
      );
    }
    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
      select: RECALLABLE_ITEM_SELECT,
    });
    const question = item ? recallQuestionFor(item) : null;
    if (!question) {
      throw new BadRequestException(
        `Item ${itemId} can't be practised right now: it has no answer to check against.`,
      );
    }

    const graded = await this.recall.grade(question, answer);
    const base = recallResult(itemId, question, graded);
    const current = async () => ({
      ...base,
      counted: false,
      mastery: await this.mastery.currentMastery(userId, itemId),
    });
    // Grader outage (unscored): nothing is written and the slot stays open.
    if (!graded.scored) return this.credited(userId, await current());

    // Double-count guardrail (J.1.c): the first scored answer claims the
    // (session, item) row and writes FSRS in the same transaction, so a
    // failed write never leaves a claim behind; repeats find the row taken
    // and are exposure-only.
    const state = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.practiceAttempt.createMany({
        data: [{ sessionId, itemId, correct: graded.correct }],
        skipDuplicates: true,
      });
      if (count === 0) return null;
      return this.mastery.recordCheckResult(
        {
          userId,
          itemId,
          format: 'TYPED',
          correct: graded.correct,
          rating: graded.rating,
        },
        tx,
      );
    });
    return this.credited(
      userId,
      state
        ? { ...base, counted: true, mastery: state.mastery }
        : await current(),
    );
  }

  /**
   * Every practice answer is effort toward today's target (K.3.b/K.3.f) —
   * repeats included — credited after any FSRS write, then passed through.
   */
  private async credited<T>(userId: string, result: T): Promise<T> {
    await this.streak.record(userId, { kind: 'answers', count: 1 });
    return result;
  }

  /** Item ids a module / chapter scope covers (undefined = everything). */
  private async scopeItemIds(
    scope: PracticeStartRequest['scope'],
  ): Promise<string[] | undefined> {
    if (scope.kind === 'weakest') return undefined;
    const exists =
      scope.kind === 'chapter'
        ? await this.prisma.chapter.findUnique({
            where: { id: scope.id },
            select: { id: true },
          })
        : await this.prisma.module.findUnique({
            where: { id: scope.id },
            select: { id: true },
          });
    if (!exists) {
      throw new NotFoundException(`${scope.kind} not found: ${scope.id}`);
    }
    const rows = await this.prisma.lessonItem.findMany({
      where: {
        role: 'TARGET',
        lesson:
          scope.kind === 'chapter'
            ? { chapterId: scope.id }
            : { chapter: { moduleId: scope.id } },
      },
      select: { itemId: true },
    });
    return [...new Set(rows.map((r) => r.itemId))];
  }
}
