import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ItemType,
  ItemTypeCounts,
  PracticeAnswerRequest,
  PracticeResultDto,
  PracticeScopesDto,
  PracticeSessionDto,
  PracticeStartRequest,
} from '@sensei/types';
import { retrievability, reviveCard } from '../mastery/fsrs';
import { MasteryService } from '../mastery/mastery.service';
import { PrismaService } from '../prisma/prisma.service';
import { RecallGraderService } from '../recall/recall-grader.service';
import { recallQuestionFor } from '../recall/recall-question';

/** Foundation is Japanese-only today (CC.1: modules are language-scoped). */
const LANGUAGE = 'ja';
/** One drill ≈ one review session (G.4: 10–15 items, ~5–10 min). */
export const PRACTICE_SESSION_SIZE = 20;

const ITEM_SELECT = {
  id: true,
  type: true,
  display: true,
  reading: true,
  meaning: true,
  data: true,
} satisfies Prisma.ItemSelect;

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
  ) {}

  /** What can be drilled: learned, quizzable item counts per module / chapter / type. */
  async scopes(userId: string): Promise<PracticeScopesDto> {
    const learned = await this.learnedItems(userId);
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
    const learned = await this.learnedItems(userId, scopeItemIds);

    // J.1.b: always lowest-retention first (G.4), then weakest modality.
    const ranked = learned
      .filter((s) => !types || types.has(s.item.type))
      .map((s) => {
        const card = reviveCard(s.fsrs);
        return {
          state: s,
          retention: card ? retrievability(card, now) : 0,
          weakest: Math.min(s.recognition, s.recall, s.production),
        };
      })
      .sort((a, b) => a.retention - b.retention || a.weakest - b.weakest)
      .slice(0, PRACTICE_SESSION_SIZE);

    if (ranked.length === 0) return { sessionId: null, items: [] };

    const items = ranked.map(({ state: { item } }) => ({
      itemId: item.id,
      type: item.type,
      display: item.display,
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
      select: ITEM_SELECT,
    });
    const question = item ? recallQuestionFor(item) : null;
    if (!question) {
      throw new BadRequestException(
        `Item ${itemId} can't be practised right now: it has no answer to check against.`,
      );
    }

    const graded = await this.recall.grade(question, answer);
    const base = {
      itemId,
      correct: graded.correct,
      correctAnswer: question.expected,
      scored: graded.scored,
      ...(graded.feedback ? { feedback: graded.feedback } : {}),
    };

    // Double-count guardrail (J.1.c): the first scored answer claims the
    // (session, item) slot and updates FSRS; repeats are exposure-only. An
    // unscored answer (grader outage) never claims it.
    let counted = false;
    if (graded.scored) {
      const { count } = await this.prisma.practiceAttempt.createMany({
        data: [{ sessionId, itemId, correct: graded.correct }],
        skipDuplicates: true,
      });
      counted = count === 1;
    }
    if (counted) {
      const state = await this.mastery
        .recordCheckResult({
          userId,
          itemId,
          format: 'TYPED',
          correct: graded.correct,
          rating: graded.rating,
        })
        .catch(async (err: unknown) => {
          // Release the claim so a retry still counts (the write never landed).
          await this.prisma.practiceAttempt
            .deleteMany({ where: { sessionId, itemId } })
            .catch(() => undefined);
          throw err;
        });
      return { ...base, counted, mastery: state.mastery };
    }
    const current = await this.prisma.itemMasteryState.findUnique({
      where: { userId_itemId: { userId, itemId } },
      select: { mastery: true },
    });
    return { ...base, counted, mastery: current?.mastery ?? 0 };
  }

  /**
   * The learner's learned (has FSRS state, J.1.e) and quizzable items,
   * optionally limited to a set of ids.
   */
  private async learnedItems(userId: string, itemIds?: string[]) {
    const states = await this.prisma.itemMasteryState.findMany({
      where: {
        userId,
        ...(itemIds ? { itemId: { in: itemIds } } : {}),
        NOT: { item: { type: 'GRAMMAR', meaning: null } },
      },
      select: {
        fsrs: true,
        recognition: true,
        recall: true,
        production: true,
        item: { select: ITEM_SELECT },
      },
    });
    return states.filter((s) => recallQuestionFor(s.item) !== null);
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
