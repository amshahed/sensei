import { Injectable, NotFoundException } from '@nestjs/common';
import type { LessonCompletionDto, LessonDetailDto } from '@sensei/types';
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

  /**
   * Marks a lesson finished for a user. Idempotent: re-completing refreshes the
   * timestamp rather than erroring. The dev user is upserted first so the FK
   * holds before Clerk-provisioned users exist (#3). Mastery/FSRS updates on
   * completion land in #6 — this only records the completion event.
   */
  async complete(
    idOrSlug: string,
    userId: string,
  ): Promise<LessonCompletionDto> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { id: true },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson not found: ${idOrSlug}`);
    }

    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });

    const completion = await this.prisma.lessonCompletion.upsert({
      where: { userId_lessonId: { userId, lessonId: lesson.id } },
      update: { completedAt: new Date() },
      create: { userId, lessonId: lesson.id },
    });

    return {
      lessonId: lesson.id,
      completed: true,
      completedAt: completion.completedAt.toISOString(),
    };
  }
}
