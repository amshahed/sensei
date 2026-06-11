import { Controller, Get, Param } from '@nestjs/common';
import type { LessonDetailDto } from '@sensei/types';
import { LessonsService } from './lessons.service';

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}

  /** Accepts a lesson id or slug. */
  @Get(':id')
  get(@Param('id') id: string): Promise<LessonDetailDto> {
    return this.lessons.getByIdOrSlug(id);
  }
}
