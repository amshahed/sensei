import { Injectable, NotFoundException } from '@nestjs/common';
import type { DueReviewItemDto, ReviewResultDto } from '@sensei/types';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from '../mastery/mastery.service';
import { normalizeAnswer } from '../common/normalize-answer';
import { reviewQuestionFor } from './review-question';

/** G.4 session cap — matches the ~5–10 min micro-session length. */
export const REVIEW_SESSION_CAP = 15;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
  ) {}

  /** Due items for a user, lowest-retention-first, capped per G.4. */
  async due(userId: string): Promise<DueReviewItemDto[]> {
    const items = await this.mastery.getDue(userId);
    return items.slice(0, REVIEW_SESSION_CAP);
  }

  /**
   * Grade one review answer against the item's expected recall, then write the
   * result back into FSRS + mastery (G.3 path, via MasteryService). Reviews are
   * typed recall in the deterministic phase, so they update the `recall`
   * breadcrumb. AI-rated, modality-varied reviews arrive with #8.
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

    const { expectedAnswer } = reviewQuestionFor(item);
    const correct = normalizeAnswer(answer) === normalizeAnswer(expectedAnswer);

    const state = await this.mastery.recordCheckResult({
      userId,
      itemId,
      format: 'TYPED',
      correct,
    });

    return {
      itemId,
      correct,
      correctAnswer: expectedAnswer,
      mastery: state.mastery,
    };
  }
}
