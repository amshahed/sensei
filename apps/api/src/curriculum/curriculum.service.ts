import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CurriculumDto,
  CurriculumKeyItemDto,
  CurriculumNextDto,
  NextLessonDto,
} from '@sensei/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  type CurriculumState,
  deriveCurriculumState,
} from './curriculum-state';

/** Foundation is Japanese-only today (CC.1: modules are language-scoped). */
const LANGUAGE = 'ja';

/** One learner's raw curriculum inputs (before state derivation). */
type CurriculumData = Awaited<ReturnType<CurriculumService['loadData']>>;
type ModuleRow = CurriculumData['modules'][number];

/**
 * Curriculum Outline (#14, I.4.e): the Module → Chapter → Lesson tree with
 * per-chapter / per-lesson state for one learner, plus "relocate position".
 * All state rules live in the pure `deriveCurriculumState`; this service loads
 * data, keeps the stored relocation pointer tidy and shapes the DTO.
 */
@Injectable()
export class CurriculumService {
  constructor(private readonly prisma: PrismaService) {}

  /** The full outline, with each lesson's key items. */
  async getCurriculum(userId: string): Promise<CurriculumDto> {
    const [{ modules, state }, keyItems] = await Promise.all([
      this.snapshot(userId),
      this.loadKeyItems(),
    ]);
    return toDto(modules, state, keyItems);
  }

  /** Just the lesson "Continue" should open — Home needs nothing else. */
  async getNext(userId: string): Promise<CurriculumNextDto> {
    const { modules, state } = await this.snapshot(userId);
    return { nextLesson: nextLessonOf(modules, state) };
  }

  /**
   * "Relocate position here" (I.4.e): move the pointer back to a chapter the
   * learner skipped (placement / skip-test) to learn it properly, or — with
   * `chapterId: null` — return to the furthest point.
   */
  async relocate(
    userId: string,
    chapterId: string | null,
  ): Promise<CurriculumDto> {
    const [data, keyItems] = await Promise.all([
      this.loadData(userId),
      this.loadKeyItems(),
    ]);
    if (chapterId !== null) {
      const actions = derive(data, data.pointer).chapterActions.get(chapterId);
      if (!actions) {
        throw new NotFoundException(`Chapter not found: ${chapterId}`);
      }
      if (!actions.relocate) {
        throw new BadRequestException(
          `Can't relocate to chapter ${chapterId}: only chapters you skipped can be relocated to.`,
        );
      }
    }
    await this.prisma.user.upsert({
      where: { id: userId },
      update: { currentChapterId: chapterId },
      create: { id: userId, currentChapterId: chapterId },
    });
    return toDto(data.modules, derive(data, chapterId), keyItems);
  }

  /**
   * Load + derive. A stored pointer that is no longer honoured (its chapter
   * has since been learned, hidden or deleted) is cleared, so it can't spring
   * back to life if that chapter later gains new lessons.
   */
  private async snapshot(userId: string) {
    const data = await this.loadData(userId);
    const state = derive(data, data.pointer);
    if (data.pointer !== null && !state.relocated) {
      // Conditional on the stale value so a concurrent relocate isn't undone.
      await this.prisma.user.updateMany({
        where: { id: userId, currentChapterId: data.pointer },
        data: { currentChapterId: null },
      });
    }
    return { modules: data.modules, state };
  }

  private async loadData(userId: string) {
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

    return {
      modules,
      completedLessonIds: new Set(completions.map((c) => c.lessonId)),
      marks: new Map(marks.map((m) => [m.chapterId, m.kind] as const)),
      pointer: user?.currentChapterId ?? null,
    };
  }

  /** TARGET items per lesson, in teaching order (outline only). */
  private async loadKeyItems(): Promise<Map<string, CurriculumKeyItemDto[]>> {
    const rows = await this.prisma.lessonItem.findMany({
      where: {
        role: 'TARGET',
        lesson: { chapter: { module: { language: LANGUAGE } } },
      },
      orderBy: { position: 'asc' },
      select: {
        lessonId: true,
        item: {
          select: { id: true, display: true, reading: true, meaning: true },
        },
      },
    });
    const byLesson = new Map<string, CurriculumKeyItemDto[]>();
    for (const { lessonId, item } of rows) {
      const list = byLesson.get(lessonId);
      if (list) list.push(item);
      else byLesson.set(lessonId, [item]);
    }
    return byLesson;
  }
}

function derive(data: CurriculumData, pointer: string | null): CurriculumState {
  return deriveCurriculumState({
    chapters: data.modules.flatMap((m) =>
      m.chapters.map((c) => ({
        id: c.id,
        lessonIds: c.lessons.map((l) => l.id),
      })),
    ),
    completedLessonIds: data.completedLessonIds,
    marks: data.marks,
    relocatedChapterId: pointer,
  });
}

function nextLessonOf(
  modules: ModuleRow[],
  state: CurriculumState,
): NextLessonDto | null {
  if (!state.nextLessonId) return null;
  for (const m of modules) {
    for (const c of m.chapters) {
      const l = c.lessons.find((x) => x.id === state.nextLessonId);
      if (l) return { slug: l.slug, title: l.title };
    }
  }
  return null;
}

function toDto(
  modules: ModuleRow[],
  state: CurriculumState,
  keyItems: Map<string, CurriculumKeyItemDto[]>,
): CurriculumDto {
  return {
    currentChapterId: state.currentChapterId,
    relocated: state.relocated,
    nextLesson: nextLessonOf(modules, state),
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
          keyItems: keyItems.get(l.id) ?? [],
        })),
      })),
    })),
  };
}
