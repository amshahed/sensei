import { Injectable } from '@nestjs/common';
import type { ItemType, ProgressDto } from '@sensei/types';
import { PrismaService } from '../prisma/prisma.service';

/** Items with mastery at or above this threshold count as "mastered" (J.2). */
const MASTERY_THRESHOLD = 0.7;

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async getProgress(userId: string): Promise<ProgressDto> {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Total catalog items by type (denominator for percentages).
    const catalogByType = await this.prisma.item.groupBy({
      by: ['type'],
      _count: { id: true },
    });

    // All mastery states for this user, with the item type attached.
    const masteryStates = await this.prisma.itemMasteryState.findMany({
      where: { userId },
      include: { item: { select: { type: true } } },
    });

    // ── Aggregate ──────────────────────────────────────────────────────────────
    const totalCatalog = catalogByType.reduce((s, g) => s + g._count.id, 0);
    const masteredCount = masteryStates.filter(
      (m) => m.mastery >= MASTERY_THRESHOLD,
    ).length;

    // ── Per-type breakdown ─────────────────────────────────────────────────────
    const typeMap = new Map<ItemType, { mastered: number; total: number }>();
    for (const g of catalogByType) {
      typeMap.set(g.type, { mastered: 0, total: g._count.id });
    }
    for (const m of masteryStates) {
      if (m.mastery >= MASTERY_THRESHOLD) {
        const entry = typeMap.get(m.item.type);
        if (entry) entry.mastered++;
      }
    }

    // ── Modality averages ──────────────────────────────────────────────────────
    const avg = (vals: number[]) =>
      vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;

    const recognition = avg(masteryStates.map((m) => m.recognition));
    const recall = avg(masteryStates.map((m) => m.recall));
    const production = avg(masteryStates.map((m) => m.production));

    // ── Recent rate ────────────────────────────────────────────────────────────
    const thisWeek = masteryStates.filter(
      (m) => m.lastReview !== null && m.lastReview >= oneWeekAgo,
    ).length;
    const lastWeek = masteryStates.filter(
      (m) =>
        m.lastReview !== null &&
        m.lastReview >= twoWeeksAgo &&
        m.lastReview < oneWeekAgo,
    ).length;

    return {
      aggregate: {
        masteredCount,
        totalItems: totalCatalog,
        masteredPercent:
          totalCatalog > 0
            ? Math.round((masteredCount / totalCatalog) * 100)
            : 0,
      },
      byType: Array.from(typeMap.entries()).map(
        ([type, { mastered, total }]) => ({
          type,
          masteredCount: mastered,
          totalItems: total,
        }),
      ),
      modality: { recognition, recall, production },
      recentRate: { thisWeek, lastWeek },
    };
  }
}
