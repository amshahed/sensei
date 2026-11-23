import { kanaChars } from '../common/japanese-script';
import type { KanaCard, LessonType, Skeleton } from './skeleton-schema';

/** What the learner has met by the end of one lesson (F.2.a). */
export interface CourseContext {
  lessonId: string;
  lessonType: LessonType;
  /** 1-based place in the course. */
  position: number;
  totalLessons: number;
  /** Kana the learner can read, this lesson's included. */
  kana: string[];
  longVowelsTaught: boolean;
  /** Grammar taught so far, this lesson's included. */
  grammar: Array<{ id: string; surface: string }>;
  /** Surfaces of words taught so far, this lesson's included. */
  words: string[];
  /** Surfaces of words taught in earlier lessons only (P4). */
  earlierWords: string[];
  /** Kanji taught so far, this lesson's targets included. */
  kanji: string[];
  /** This lesson's targets (kanji targets excluded). */
  targets: Array<{ id: string; surface: string }>;
  /**
   * The targets no earlier lesson taught: what the learner meets here for the
   * first time (P4). A target practised again, as I- lessons do, isn't new.
   */
  newTargetIds: string[];
  /** This lesson's kanji that no earlier lesson taught (P4). */
  newKanji: string[];
  hasKanaTargets: boolean;
  kanaCards: KanaCard[];
  typedReading: boolean;
  authorNote?: string;
}

/** An item id's kind: ja:vocab:猫 is vocab. */
export const kindOf = (itemId: string) => itemId.split(':')[1];

/**
 * The context of one lesson, computed from a compiled outline. Null for a
 * model-written skeleton, which has no surfaces, or an unknown lesson: such a
 * lesson drafts without context and skips the gate, as before.
 */
export function courseContextFor(
  skeleton: Skeleton,
  lessonId: string,
): CourseContext | null {
  const surfaces = skeleton.surfaces;
  if (!surfaces) return null;
  const lessons = skeleton.module.chapters.flatMap((c) => c.lessons);
  const index = lessons.findIndex((l) => l.id === lessonId);
  if (index === -1) return null;
  const lesson = lessons[index];

  const reached = new Set(lessons.slice(0, index + 1).map((l) => l.id));
  const taughtEarlier = new Set(
    lessons.slice(0, index).flatMap((l) => l.itemIds),
  );
  const targets = lesson.itemIds
    .filter((id) => kindOf(id) !== 'kanji')
    .map((id) => ({ id, surface: surfaces[id] ?? '' }));
  const stages = (skeleton.soundStages ?? []).filter((s) =>
    reached.has(s.lessonId),
  );

  const kana = new Set<string>();
  const grammar = new Map<string, string>();
  const words = new Set<string>();
  const earlierWords = new Set<string>();
  const kanji = new Set<string>();
  for (const [i, l] of lessons.slice(0, index + 1).entries()) {
    for (const id of l.itemIds) {
      const surface = surfaces[id] ?? '';
      const kind = kindOf(id);
      if (kind === 'kana') for (const c of kanaChars(surface)) kana.add(c);
      else if (kind === 'vocab') {
        words.add(surface);
        if (i < index) earlierWords.add(surface);
      } else if (kind === 'grammar') grammar.set(id, surface);
      else if (kind === 'kanji') kanji.add(id.split(':')[2]);
    }
  }
  for (const stage of stages) {
    for (const c of kanaChars(stage.chars ?? '')) kana.add(c);
  }

  return {
    lessonId,
    lessonType: lesson.type,
    position: index + 1,
    totalLessons: lessons.length,
    kana: [...kana],
    longVowelsTaught: stages.some((s) => s.longVowels),
    grammar: [...grammar].map(([id, surface]) => ({ id, surface })),
    words: [...words],
    earlierWords: [...earlierWords],
    kanji: [...kanji],
    targets,
    newTargetIds: targets
      .map((t) => t.id)
      .filter((id) => !taughtEarlier.has(id)),
    newKanji: lesson.itemIds
      .filter((id) => kindOf(id) === 'kanji' && !taughtEarlier.has(id))
      .map((id) => id.split(':')[2]),
    hasKanaTargets: lesson.itemIds.some((id) => kindOf(id) === 'kana'),
    kanaCards: lesson.kanaCards ?? [],
    typedReading: lesson.typedReading === true,
    ...(lesson.authorNote ? { authorNote: lesson.authorNote } : {}),
  };
}
