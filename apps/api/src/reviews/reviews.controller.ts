import { Controller, Get } from '@nestjs/common';
import type { DueReviewItemDto } from '@sensei/types';
import { CurrentUserId } from '../auth/current-user.decorator';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** Items due for review now, lowest-retention-first (G.4). */
  @Get('due')
  due(@CurrentUserId() userId: string): Promise<DueReviewItemDto[]> {
    return this.reviews.due(userId);
  }
}
