import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { LessonCompletionDto, LessonDetailDto } from '@sensei/types';
import { PrismaService } from '../prisma/prisma.service';
import { StreakService } from '../streak/streak.service';
import { lessonDetailArgs, toLessonDetailDto } from './lesson.mapper';

@Injectable()
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly streak: StreakService,
  ) {}

  /** Match a lesson by primary id or by slug (slug eases manual/testing access). */
  private static idOrSlug(value: string): Prisma.LessonWhereInput {
    return { OR: [{ id: value }, { slug: value }] };
  }

  async getByIdOrSlug(idOrSlug: string): Promise<LessonDetailDto> {
    const lesson = await this.prisma.lesson.findFirst({
      where: LessonsService.idOrSlug(idOrSlug),
      ...lessonDetailArgs,
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson not found: ${idOrSlug}`);
    }

    return toLessonDetailDto(lesson);
  }

  /**
   * Marks a lesson finished for a user. Idempotent: re-completing refreshes the
   * timestamp rather than erroring. Only the first completion credits the
   * lesson's minutes to the learning streak (K.3.f) — repeats can't be farmed. The dev user is upserted first so the FK
   * holds before Clerk-provisioned users exist (#3). Mastery/FSRS updates on
   * completion land in #6 — this only records the completion event.
   */
  async complete(
    idOrSlug: string,
    userId: string,
  ): Promise<LessonCompletionDto> {
    const lesson = await this.prisma.lesson.findFirst({
      where: LessonsService.idOrSlug(idOrSlug),
      select: { id: true, estimatedMinutes: true },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson not found: ${idOrSlug}`);
    }

    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });

    const where = { userId_lessonId: { userId, lessonId: lesson.id } };
    const { count } = await this.prisma.lessonCompletion.createMany({
      data: [{ userId, lessonId: lesson.id }],
      skipDuplicates: true,
    });
    const completion =
      count === 1
        ? await this.prisma.lessonCompletion.findUniqueOrThrow({ where })
        : await this.prisma.lessonCompletion.update({
            where,
            data: { completedAt: new Date() },
          });
    if (count === 1) {
      await this.streak.record(userId, {
        kind: 'lesson',
        estimatedMinutes: lesson.estimatedMinutes,
      });
    }

    return {
      lessonId: lesson.id,
      completed: true,
      completedAt: completion.completedAt.toISOString(),
    };
  }
}
