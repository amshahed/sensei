import { Injectable } from '@nestjs/common';
import type { DueReviewItemDto } from '@sensei/types';
import { MasteryService } from '../mastery/mastery.service';

/** G.4 session cap — matches the ~5–10 min micro-session length. */
export const REVIEW_SESSION_CAP = 15;

@Injectable()
export class ReviewsService {
  constructor(private readonly mastery: MasteryService) {}

  /** Due items for a user, lowest-retention-first, capped per G.4. */
  async due(userId: string): Promise<DueReviewItemDto[]> {
    const items = await this.mastery.getDue(userId);
    return items.slice(0, REVIEW_SESSION_CAP);
  }
}
