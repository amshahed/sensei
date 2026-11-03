import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import type {
  CurriculumDto,
  CurriculumNextDto,
  RelocateRequest,
} from '@sensei/types';
import { CurrentUserId } from '../auth/current-user.decorator';
import { CurriculumService } from './curriculum.service';

@Controller('curriculum')
export class CurriculumController {
  constructor(private readonly curriculum: CurriculumService) {}

  /** The learner's Curriculum Outline (I.4.e). */
  @Get()
  get(@CurrentUserId() userId: string): Promise<CurriculumDto> {
    return this.curriculum.getCurriculum(userId);
  }

  /** Just the next lesson — what Home's "Continue" needs. */
  @Get('next')
  next(@CurrentUserId() userId: string): Promise<CurriculumNextDto> {
    return this.curriculum.getNext(userId);
  }

  /**
   * "Relocate position here" — `{ chapterId }` goes back to a skipped chapter,
   * `{ chapterId: null }` returns to the furthest point. Returns the outline.
   */
  @Post('relocate')
  relocate(
    @Body() body: Partial<RelocateRequest> | undefined,
    @CurrentUserId() userId: string,
  ): Promise<CurriculumDto> {
    const chapterId = body?.chapterId;
    const valid =
      chapterId === null ||
      (typeof chapterId === 'string' && chapterId.trim() !== '');
    if (!valid) {
      throw new BadRequestException(
        'Body must be { "chapterId": string | null }.',
      );
    }
    return this.curriculum.relocate(userId, chapterId);
  }
}
