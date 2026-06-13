import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type {
  DueReviewItemDto,
  ReviewAnswerRequest,
  ReviewResultDto,
} from '@sensei/types';
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

  /** Submit a review answer for one item; updates FSRS + mastery. */
  @Post(':itemId/answer')
  answer(
    @Param('itemId') itemId: string,
    @Body() body: ReviewAnswerRequest,
    @CurrentUserId() userId: string,
  ): Promise<ReviewResultDto> {
    return this.reviews.grade(userId, itemId, body.answer ?? '');
  }
}
