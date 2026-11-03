import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CurriculumDto } from '@sensei/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  type CurriculumState,
  deriveCurriculumState,
} from './curriculum-state';

/** Foundation is Japanese-only today (CC.1: modules are language-scoped). */
const LANGUAGE = 'ja';

/**
 * Curriculum Outline (#14, I.4.e): the Module → Chapter → Lesson tree with
 * per-chapter / per-lesson state for one learner, plus "relocate position".
 * All state rules live in the pure `deriveCurriculumState`; this service only
 * loads data and shapes the DTO.
 */
@Injectable()
export class CurriculumService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurriculum(userId: string): Promise<CurriculumDto> {
    const { modules, state } = await this.load(userId);

    const lessonsById = new Map(
      modules.flatMap((m) =>
        m.chapters.flatMap((c) => c.lessons.map((l) => [l.id, l] as const)),
      ),
    );
    const next = state.nextLessonId
      ? lessonsById.get(state.nextLessonId)
      : undefined;

    return {
      currentChapterId: state.currentChapterId,
      nextLesson: next ? { slug: next.slug, title: next.title } : null,
      modules: modules.map((m) => ({
        id: m.id,
        slug: m.slug,
        title: m.title,
        position: m.position,
        chapters: m.chapters.map((c) => ({
          id: c.id,
          slug: c.slug,
          title: c.title,
          position: c.position,
          lessonCount: c.lessons.length,
          estimatedMinutes: c.lessons.reduce(
            (sum, l) => sum + (l.estimatedMinutes ?? 0),
            0,
          ),
          state: state.chapterStates.get(c.id)!,
          actions: state.chapterActions.get(c.id)!,
          lessons: c.lessons.map((l) => ({
            id: l.id,
            slug: l.slug,
            title: l.title,
            type: l.type,
            position: l.position,
            estimatedMinutes: l.estimatedMinutes,
            state: state.lessonStates.get(l.id)!,
            keyItems: l.items.map(({ item }) => ({
              id: item.id,
              display: item.display,
              reading: item.reading,
              meaning: item.meaning,
            })),
          })),
        })),
      })),
    };
  }

  /**
   * "Relocate position here" (I.4.e): move the pointer back to a chapter the
   * learner skipped (placement / skip-test) to learn it properly — or, while
   * relocated, forward to their frontier again (clears the override).
   */
  async relocate(userId: string, chapterId: string): Promise<CurriculumDto> {
    const { state } = await this.load(userId);
    const actions = state.chapterActions.get(chapterId);
    if (!actions) {
      throw new NotFoundException(`Chapter not found: ${chapterId}`);
    }
    if (!actions.relocate) {
      throw new BadRequestException(
        `Can't relocate to chapter ${chapterId}: only chapters you skipped (or your furthest point, to return to it) can be relocated to.`,
      );
    }
    const pointer = chapterId === state.frontierChapterId ? null : chapterId;
    await this.prisma.user.upsert({
      where: { id: userId },
      update: { currentChapterId: pointer },
      create: { id: userId, currentChapterId: pointer },
    });
    return this.getCurriculum(userId);
  }

  private async load(userId: string) {
    const [allModules, completions, marks, user] = await Promise.all([
      this.prisma.module.findMany({
        where: { language: LANGUAGE },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          slug: true,
          title: true,
          position: true,
          chapters: {
            orderBy: { position: 'asc' },
            select: {
              id: true,
              slug: true,
              title: true,
              position: true,
              lessons: {
                orderBy: { position: 'asc' },
                select: {
                  id: true,
                  slug: true,
                  title: true,
                  type: true,
                  position: true,
                  estimatedMinutes: true,
                  items: {
                    where: { role: 'TARGET' },
                    orderBy: { position: 'asc' },
                    select: {
                      item: {
                        select: {
                          id: true,
                          display: true,
                          reading: true,
                          meaning: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.lessonCompletion.findMany({
        where: { userId },
        select: { lessonId: true },
      }),
      this.prisma.userChapterMark.findMany({
        where: { userId },
        select: { chapterId: true, kind: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { currentChapterId: true },
      }),
    ]);

    // A chapter with no published lessons isn't playable — hide it (and any
    // module left empty) rather than let it block the frontier.
    const modules = allModules
      .map((m) => ({
        ...m,
        chapters: m.chapters.filter((c) => c.lessons.length > 0),
      }))
      .filter((m) => m.chapters.length > 0);

    const state: CurriculumState = deriveCurriculumState({
      chapters: modules.flatMap((m) =>
        m.chapters.map((c) => ({
          id: c.id,
          lessonIds: c.lessons.map((l) => l.id),
        })),
      ),
      completedLessonIds: new Set(completions.map((c) => c.lessonId)),
      marks: new Map(marks.map((m) => [m.chapterId, m.kind] as const)),
      relocatedChapterId: user?.currentChapterId ?? null,
    });

    return { modules, state };
  }
}
