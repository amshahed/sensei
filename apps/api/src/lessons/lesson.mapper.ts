import { Prisma } from '@prisma/client';
import type { CheckDto, LessonDetailDto, LessonItemDto } from '@sensei/types';

/**
 * Single source of truth for the relations a lesson detail needs. Used both for
 * the Prisma query and to derive the payload type the mapper consumes, so the
 * two never drift.
 */
export const lessonDetailArgs = Prisma.validator<Prisma.LessonDefaultArgs>()({
  include: {
    chapter: { include: { module: true } },
    items: { include: { item: true }, orderBy: { position: 'asc' } },
    checks: { orderBy: { position: 'asc' } },
  },
});

export type LessonWithRelations = Prisma.LessonGetPayload<
  typeof lessonDetailArgs
>;

export function toLessonDetailDto(
  lesson: LessonWithRelations,
): LessonDetailDto {
  return {
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    type: lesson.type,
    estimatedMinutes: lesson.estimatedMinutes,
    module: {
      id: lesson.chapter.module.id,
      title: lesson.chapter.module.title,
    },
    chapter: { id: lesson.chapter.id, title: lesson.chapter.title },
    teach: lesson.teach,
    items: lesson.items.map(mapLessonItem),
    checks: lesson.checks.map(mapCheck),
  };
}

function mapLessonItem(
  link: LessonWithRelations['items'][number],
): LessonItemDto {
  return {
    id: link.item.id,
    language: link.item.language,
    type: link.item.type,
    display: link.item.display,
    reading: link.item.reading,
    meaning: link.item.meaning,
    role: link.role,
  };
}

function mapCheck(check: LessonWithRelations['checks'][number]): CheckDto {
  const data = (check.data ?? {}) as { choices?: unknown };
  const choices = Array.isArray(data.choices)
    ? data.choices.filter((c): c is string => typeof c === 'string')
    : undefined;

  // Note: the correct answer (check.data.answer) is deliberately NOT mapped —
  // grading is server-side (#5), so the client never receives it.
  return {
    id: check.id,
    position: check.position,
    prompt: check.prompt,
    format: check.format,
    targetItemId: check.targetItemId,
    ...(choices ? { choices } : {}),
  };
}
