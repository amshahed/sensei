import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import type { CurriculumDto, RelocateRequest } from '@sensei/types';
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

  /** "Relocate position here" — returns the updated outline. */
  @Post('relocate')
  relocate(
    @Body() body: Partial<RelocateRequest> | undefined,
    @CurrentUserId() userId: string,
  ): Promise<CurriculumDto> {
    const chapterId = body?.chapterId;
    if (typeof chapterId !== 'string' || !chapterId.trim()) {
      throw new BadRequestException('Body must be { "chapterId": string }.');
    }
    return this.curriculum.relocate(userId, chapterId);
  }
}
