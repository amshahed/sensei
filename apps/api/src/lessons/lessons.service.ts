import { Injectable, NotFoundException } from '@nestjs/common';
import type { LessonDetailDto } from '@sensei/types';
import { PrismaService } from '../prisma/prisma.service';
import { lessonDetailArgs, toLessonDetailDto } from './lesson.mapper';

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Looks up by primary id or by slug (slug makes manual/testing access easy). */
  async getByIdOrSlug(idOrSlug: string): Promise<LessonDetailDto> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      ...lessonDetailArgs,
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson not found: ${idOrSlug}`);
    }

    return toLessonDetailDto(lesson);
  }
}
