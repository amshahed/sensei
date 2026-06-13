import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CheckFormat,
  DueReviewItemDto,
  ItemMasteryDto,
  Modality,
} from '@sensei/types';
import { PrismaService } from '../prisma/prisma.service';
import { reviewQuestionFor } from '../reviews/review-question';
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
  /** Defaults to now; injectable for deterministic tests. */
  reviewedAt?: Date;
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
   * phase; real users arrive with #3).
   */
  async recordCheckResult(
    input: RecordCheckResultInput,
  ): Promise<ItemMasteryDto> {
    const now = input.reviewedAt ?? new Date();
    const { userId, itemId } = input;

    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });

    const existing = await this.prisma.itemMasteryState.findUnique({
      where: { userId_itemId: { userId, itemId } },
    });

    const priorCard = reviveCard(existing?.fsrs) ?? emptyCard(now);
    const card = applyRating(priorCard, ratingFromCorrect(input.correct), now);

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

    const saved = await this.prisma.itemMasteryState.upsert({
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
   * Due-review queue (G.4): items whose next review has come up, sorted by
   * lowest predicted retention first (closest to being forgotten). Items not
   * yet due are not surfaced — a short queue means the learner is on track.
   */
  async getDue(
    userId: string,
    now: Date = new Date(),
  ): Promise<DueReviewItemDto[]> {
    const states = await this.prisma.itemMasteryState.findMany({
      where: { userId, due: { lte: now } },
      include: { item: true },
    });

    return states
      .map((s) => {
        const card = reviveCard(s.fsrs);
        return {
          itemId: s.itemId,
          type: s.item.type,
          display: s.item.display,
          reading: s.item.reading,
          meaning: s.item.meaning,
          mastery: s.mastery,
          retrievability: card ? retrievability(card, now) : 0,
          due: (s.due ?? now).toISOString(),
          weakestModality: weakestModality(s),
          prompt: reviewQuestionFor(s.item).prompt,
        };
      })
      .sort((a, b) => a.retrievability - b.retrievability);
  }
}
