import { Prisma } from '@prisma/client';
import type { CheckDto, LessonDetailDto, LessonItemDto } from '@sensei/types';
import { learnerSurface } from '../recall/learner-surface';
import { recapBackFor } from '../recall/recall-question';
import { isOpenCheck } from '../checks/check-kind';
import { ANSWER_PUNCTUATION, READING_MARKS } from '../common/japanese-script';
import { shuffle } from '../common/shuffle';

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

/**
 * The lesson as the app shows it. `random` orders each multiple-choice
 * check's options afresh on every call, so the right answer sits in no fixed
 * place (B.2.e, B.2.f). It is required so no caller can serve authored order,
 * which puts the answer first in almost every live check.
 */
export function toLessonDetailDto(
  lesson: LessonWithRelations,
  random: () => number,
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
    teach: mapTeach(lesson.teach),
    items: lesson.items.map(mapLessonItem),
    checks: lesson.checks.map((check) => mapCheck(check, random)),
  };
}

/**
 * What an example's reading line is compared without (brief 4.3): spaces,
 * the grader's punctuation and READING_MARKS. ー is content and stays.
 */
const SAME_LINE_IGNORED = new RegExp(
  `[\\s${ANSWER_PUNCTUATION}${READING_MARKS}]`,
  'gu',
);

/** Whether a reading line says exactly what the Japanese line above it says. */
export function readingRepeatsJapanese(
  reading: string,
  japanese: string,
): boolean {
  const bare = (s: string) => s.replace(SAME_LINE_IGNORED, '');
  return bare(reading) === bare(japanese);
}

/**
 * The Teach beat as the app shows it: an example whose reading repeats its
 * Japanese loses the reading, so an all-kana line isn't printed twice (P3).
 * Display only; nothing stored changes. Every other block, and any shape this
 * doesn't recognise, passes through untouched.
 */
export function mapTeach(teach: unknown): unknown {
  if (!isRecord(teach) || !Array.isArray(teach.blocks)) return teach;
  return { ...teach, blocks: teach.blocks.map(mapTeachBlock) };
}

function mapTeachBlock(block: unknown): unknown {
  if (!isRecord(block)) return block;
  // Either discriminant, as the app's parser accepts (teach.ts).
  const kind = typeof block.kind === 'string' ? block.kind : block.type;
  if (
    kind !== 'example' ||
    typeof block.japanese !== 'string' ||
    typeof block.reading !== 'string' ||
    !readingRepeatsJapanese(block.reading, block.japanese)
  ) {
    return block;
  }
  const shown = { ...block };
  delete shown.reading;
  return shown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mapLessonItem(
  link: LessonWithRelations['items'][number],
): LessonItemDto {
  return {
    id: link.item.id,
    language: link.item.language,
    type: link.item.type,
    display: learnerSurface(link.item),
    reading: link.item.reading,
    meaning: link.item.meaning,
    recap: recapBackFor(link.item),
    role: link.role,
  };
}

function mapCheck(
  check: LessonWithRelations['checks'][number],
  random: () => number,
): CheckDto {
  const data = (check.data ?? {}) as { choices?: unknown };
  // A fresh, uniform order per call. It never looks at the answer or the
  // authored order: any rule about where the answer may go is itself a cue.
  // filter() makes a copy, so the stored options are never reordered.
  const choices = Array.isArray(data.choices)
    ? shuffle(
        data.choices.filter((c): c is string => typeof c === 'string'),
        random,
      )
    : undefined;

  // Note: the correct answer (check.data.answer) is deliberately NOT mapped —
  // grading is server-side (#5), so the client never receives it. Nor are an
  // open check's exemplar and rubric: only the fact that it is open (B.2.d).
  return {
    id: check.id,
    position: check.position,
    prompt: check.prompt,
    format: check.format,
    targetItemId: check.targetItemId,
    ...(choices ? { choices } : {}),
    ...(isOpenCheck(check.format, check.data) ? { open: true as const } : {}),
  };
}
