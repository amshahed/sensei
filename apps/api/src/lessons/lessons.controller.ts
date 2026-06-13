import { Controller, Get, Param, Post } from '@nestjs/common';
import type { LessonCompletionDto, LessonDetailDto } from '@sensei/types';
import { CurrentUserId } from '../auth/current-user.decorator';
import { LessonsService } from './lessons.service';

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}

  /** Accepts a lesson id or slug. */
  @Get(':id')
  get(@Param('id') id: string): Promise<LessonDetailDto> {
    return this.lessons.getByIdOrSlug(id);
  }

  /** Mark the lesson finished for the current user (id or slug). */
  @Post(':id/complete')
  complete(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
  ): Promise<LessonCompletionDto> {
    return this.lessons.complete(id, userId);
  }
}
