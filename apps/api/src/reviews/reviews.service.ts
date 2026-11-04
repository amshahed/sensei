import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DueReviewItemDto, ReviewResultDto } from '@sensei/types';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from '../mastery/mastery.service';
import {
  RecallGraderService,
  recallResult,
} from '../recall/recall-grader.service';
import { recallQuestionFor } from '../recall/recall-question';
import { StreakService } from '../streak/streak.service';

import { REVIEW_SESSION_CAP } from '../mastery/mastery.service';

export { REVIEW_SESSION_CAP };

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
    private readonly recall: RecallGraderService,
    private readonly streak: StreakService,
  ) {}

  /** Due items for a user, lowest-retention-first, capped per G.4. */
  async due(userId: string): Promise<DueReviewItemDto[]> {
    const items = await this.mastery.getDue(userId);
    return items.slice(0, REVIEW_SESSION_CAP);
  }

  /**
   * Grade one review answer with the shared recall rules (same questions and
   * grading as Assessments and Practice), then write the result back into
   * FSRS + mastery (G.3 path, via MasteryService). Typed recall updates the
   * `recall` breadcrumb.
   */
  async grade(
    userId: string,
    itemId: string,
    answer: string,
  ): Promise<ReviewResultDto> {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException(`Item not found: ${itemId}`);
    }
    const question = recallQuestionFor(item);
    if (!question) {
      throw new BadRequestException(
        `Item ${itemId} can't be reviewed yet: it has no answer to check against.`,
      );
    }

    // Read before the FSRS write moves it: only a scored answer to an item
    // that was actually due clears part of today's reviews (K.3.f).
    const now = new Date();
    const wasDue = await this.prisma.itemMasteryState.findFirst({
      where: { userId, itemId, due: { lte: now } },
      select: { itemId: true },
    });
    const graded = await this.recall.grade(question, answer);
    const base = recallResult(itemId, question, graded);
    let mastery: number;
    if (!graded.scored) {
      // AI grader down and its fallback said "wrong": show the answer and
      // move on, but don't record a miss that may not be one (same as
      // lesson Checks).
      mastery = await this.mastery.currentMastery(userId, itemId);
    } else {
      const state = await this.mastery.recordCheckResult({
        userId,
        itemId,
        format: 'TYPED',
        correct: graded.correct,
        rating: graded.rating,
      });
      mastery = state.mastery;
    }
    // The answer was real effort either way (K.3.f); credited after the FSRS
    // write so "reviews cleared" sees this item as no longer due. Repeats,
    // not-yet-due items and unscored answers are effort, not reviews.
    await this.streak.record(userId, {
      kind: 'answers',
      count: 1,
      review: graded.scored && wasDue !== null,
    });
    return { ...base, mastery };
  }
}
