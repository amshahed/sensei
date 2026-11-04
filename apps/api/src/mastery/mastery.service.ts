import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CheckFormat,
  DueReviewItemDto,
  ItemMasteryDto,
  Modality,
} from '@sensei/types';
import { type Grade, Rating } from 'ts-fsrs';
import { PrismaService } from '../prisma/prisma.service';
import {
  RECALLABLE_ITEM_SELECT,
  recallQuestionFor,
} from '../recall/recall-question';
import {
  applyRating,
  emptyCard,
  masteryFromStability,
  modalityForFormat,
  ratingFromCorrect,
  retrievability,
  reviveCard,
  serializeCard,
  updateBreadcrumb,
} from './fsrs';

export interface RecordCheckResultInput {
  userId: string;
  itemId: string;
  format: CheckFormat;
  correct: boolean;
  /**
   * Explicit FSRS rating (from AI grading, #8). When omitted, derived from
   * `correct` (deterministic Good/Again).
   */
  rating?: Grade;
  /** Defaults to now; injectable for deterministic tests. */
  reviewedAt?: Date;
}

/** G.4 session cap — matches the ~5–10 min micro-session length. */
export const REVIEW_SESSION_CAP = 15;

/** The FSRS card + modality breadcrumbs that G.4 ranks by. */
interface RankableState {
  fsrs: unknown;
  recognition: number;
  recall: number;
  production: number;
}

/**
 * G.4 selection order, shared by Reviews and Practice (J.1.b): lowest
 * predicted retention first (closest to being forgotten), ties broken by the
 * weakest modality breadcrumb.
 */
export function rankWeakest<T extends RankableState>(
  states: T[],
  now: Date,
): Array<{ state: T; retrievability: number }> {
  return states
    .map((state) => {
      const card = reviveCard(state.fsrs);
      return {
        state,
        retrievability: card ? retrievability(card, now) : 0,
        weakest: Math.min(state.recognition, state.recall, state.production),
      };
    })
    .sort(
      (a, b) => a.retrievability - b.retrievability || a.weakest - b.weakest,
    )
    .map(({ state, retrievability }) => ({ state, retrievability }));
}

/** Pick the weakest of the three modality breadcrumbs (G.4 targeting). */
function weakestModality(state: {
  recognition: number;
  recall: number;
  production: number;
}): Modality {
  const entries: [Modality, number][] = [
    ['recognition', state.recognition],
    ['recall', state.recall],
    ['production', state.production],
  ];
  return entries.reduce((min, e) => (e[1] < min[1] ? e : min))[0];
}

@Injectable()
export class MasteryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write-back path (G.3): a graded Check updates the learner's FSRS schedule
   * and the modality breadcrumb the Check exercised, then recomputes the 0–1
   * mastery score. Idempotently ensures the user row exists first (dev-user
   * phase; real users arrive with #3). Pass `db` to run inside a caller's
   * transaction.
   */
  async recordCheckResult(
    input: RecordCheckResultInput,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<ItemMasteryDto> {
    const now = input.reviewedAt ?? new Date();
    const { userId, itemId } = input;

    await db.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });

    const existing = await db.itemMasteryState.findUnique({
      where: { userId_itemId: { userId, itemId } },
    });

    const priorCard = reviveCard(existing?.fsrs) ?? emptyCard(now);
    const grade = input.rating ?? ratingFromCorrect(input.correct);
    const card = applyRating(priorCard, grade, now);

    const modality = modalityForFormat(input.format);
    const priorBreadcrumb = existing ? existing[modality] : 0;
    const breadcrumb = updateBreadcrumb(priorBreadcrumb, input.correct);
    const mastery = masteryFromStability(card.stability);

    // Only the exercised modality's breadcrumb is touched; the others stay put
    // (undefined ⇒ "leave as-is" on update, default 0 on create). Explicit keys
    // avoid a computed-key index type that won't satisfy Prisma's input shape.
    const writable = {
      fsrs: serializeCard(card) as Prisma.InputJsonValue,
      mastery,
      due: card.due,
      lastReview: now,
      recognition: modality === 'recognition' ? breadcrumb : undefined,
      recall: modality === 'recall' ? breadcrumb : undefined,
      production: modality === 'production' ? breadcrumb : undefined,
    };

    const saved = await db.itemMasteryState.upsert({
      where: { userId_itemId: { userId, itemId } },
      update: writable,
      create: { userId, itemId, ...writable },
    });

    return {
      itemId,
      mastery: saved.mastery,
      recognition: saved.recognition,
      recall: saved.recall,
      production: saved.production,
      retrievability: retrievability(card, now),
      due: saved.due ? saved.due.toISOString() : null,
    };
  }

  /**
   * Inferred mastery (I.4.c tier 2 — a passed chapter Assessment, I.4.d.a, or
   * a chapter skipped by placement, I.4.f): items the learner wasn't directly
   * tested on enter FSRS at moderate confidence — a Hard first review, so
   * Reviews confirm them early. Returns how many items were seeded.
   */
  seedInferred(
    userId: string,
    itemIds: string[],
    now: Date = new Date(),
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return this.seed(userId, itemIds, Rating.Hard, now, db);
  }

  /**
   * Placement evidence (I.4.c tier 1 / I.4.f): items answered correctly in
   * the multiple-choice placement quiz enter FSRS as a Good first review
   * (high retention) with a recognition breadcrumb. Returns how many were seeded.
   */
  seedTested(
    userId: string,
    itemIds: string[],
    now: Date = new Date(),
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return this.seed(userId, itemIds, Rating.Good, now, db, {
      recognition: updateBreadcrumb(0, true),
    });
  }

  /**
   * Seed first-review FSRS state for items the learner has no state for yet.
   * Existing state is never touched: a seed is weaker evidence than any
   * review the learner has actually done.
   */
  private async seed(
    userId: string,
    itemIds: string[],
    rating: Grade,
    now: Date,
    db: Prisma.TransactionClient,
    breadcrumbs: { recognition?: number } = {},
  ): Promise<number> {
    if (itemIds.length === 0) return 0;
    const existing = await db.itemMasteryState.findMany({
      where: { userId, itemId: { in: itemIds } },
      select: { itemId: true },
    });
    const known = new Set(existing.map((e) => e.itemId));
    const fresh = [...new Set(itemIds)].filter((id) => !known.has(id));
    if (fresh.length === 0) return 0;

    const card = applyRating(emptyCard(now), rating, now);
    const fsrs = serializeCard(card) as Prisma.InputJsonValue;
    const mastery = masteryFromStability(card.stability);
    const { count } = await db.itemMasteryState.createMany({
      data: fresh.map((itemId) => ({
        userId,
        itemId,
        fsrs,
        mastery,
        due: card.due,
        lastReview: now,
        ...breadcrumbs,
      })),
      skipDuplicates: true,
    });
    return count;
  }

  /** The learner's current 0–1 mastery of an item (0 if never seen). */
  async currentMastery(userId: string, itemId: string): Promise<number> {
    const state = await this.prisma.itemMasteryState.findUnique({
      where: { userId_itemId: { userId, itemId } },
      select: { mastery: true },
    });
    return state?.mastery ?? 0;
  }

  /**
   * The learner's learned (has an FSRS record, J.1.e) items that can be
   * quizzed right now, optionally limited to `itemIds`. What Practice drills.
   */
  async learnedQuizzable(userId: string, itemIds?: string[]) {
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
        item: { select: RECALLABLE_ITEM_SELECT },
      },
    });
    return states.filter((s) => recallQuestionFor(s.item) !== null);
  }

  /**
   * Due-review queue (G.4): items whose next review has come up, sorted by
   * lowest predicted retention first (closest to being forgotten). Items not
   * yet due are not surfaced — a short queue means the learner is on track.
   */
  async getDue(
    userId: string,
    now: Date = new Date(),
  ): Promise<DueReviewItemDto[]> {
    const states = await this.prisma.itemMasteryState.findMany({
      where: {
        userId,
        due: { lte: now },
        // Grammar shells without a meaning can't be quizzed (the common
        // non-quizzable case) — keep them out of the query itself.
        NOT: { item: { type: 'GRAMMAR', meaning: null } },
      },
      include: { item: true },
    });

    // Items with no quizzable question yet (e.g. a grammar shell without a
    // meaning) stay scheduled but aren't surfaced until their content exists.
    const quizzable = states.flatMap((s) => {
      const question = recallQuestionFor(s.item);
      return question ? { ...s, prompt: question.prompt } : [];
    });
    return rankWeakest(quizzable, now).map(({ state: s, retrievability }) => ({
      itemId: s.itemId,
      type: s.item.type,
      display: s.item.display,
      mastery: s.mastery,
      retrievability,
      due: (s.due ?? now).toISOString(),
      weakestModality: weakestModality(s),
      prompt: s.prompt,
    }));
  }
}
