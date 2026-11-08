import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import type { ItemType } from '@sensei/types';
import {
  hasKanji,
  hasLongVowel,
  kanaChars,
  toHiraganaChars,
} from '../common/japanese-script';
import { learnerSurface } from '../recall/learner-surface';
import { HOMOPHONE_CONTEXT } from '../recall/recall-question';
import {
  ChapterSchema,
  COMPILED_OUTLINE_MODEL,
  SkeletonSchema,
  SoundStageSchema,
  type Lesson,
  type Skeleton,
} from './skeleton-schema';

/** The committed beta outline (F.1.b). Binding on order (F.1.a). */
export const OutlineSpecSchema = z.object({
  module: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    language: z.string().min(1),
  }),
  soundStages: z.array(SoundStageSchema),
  /** Grammar id or lesson id to the grammar that must be taught before it. */
  grammarPrereqs: z.record(z.string(), z.array(z.string())),
  /** Item id to the surface served to the learner. Not for kanji items. */
  surfaces: z.record(z.string(), z.string()),
  chapters: z.array(ChapterSchema).min(1),
});
export type OutlineSpec = z.infer<typeof OutlineSpecSchema>;

export const OUTLINE_SPEC_PATH = path.resolve(
  __dirname,
  '../../data/curriculum/foundation-ja-beta.json',
);

export function loadOutlineSpec(file: string = OUTLINE_SPEC_PATH): OutlineSpec {
  return OutlineSpecSchema.parse(
    JSON.parse(fs.readFileSync(file, 'utf8')) as unknown,
  );
}

/** `authoring:skeleton` must not replace the compiled outline (F.1.a), even with --force. */
export function assertNotCompiledOutline(file: string): void {
  if (!fs.existsSync(file)) return;
  let model: unknown;
  try {
    ({ model } = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      model?: unknown;
    });
  } catch {
    return; // Not a skeleton this guard knows about.
  }
  if (model === COMPILED_OUTLINE_MODEL) {
    throw new Error(
      `${file} is the compiled beta outline, and its order is fixed (F.1.a). A model must not replace it, even with --force. Run authoring:outline, or use a different --output.`,
    );
  }
}

const kindOf = (itemId: string) => itemId.split(':')[1];
const isKanjiId = (itemId: string) => kindOf(itemId) === 'kanji';
const displayFromId = (itemId: string) => itemId.split(':')[2];

/** The item kind each foundational lesson type must target. */
const FOUNDATIONAL_KIND: Record<string, string | undefined> = {
  'F-Kana': 'kana',
  'F-Vocab': 'vocab',
  'F-Kanji': 'kanji',
  'F-Grammar': 'grammar',
};

/** Words per sound group that the slice must carry (D.2.a). */
const SOUND_FLOORS: Array<{
  label: string;
  floor: number;
  has: (hiragana: string) => boolean;
}> = [
  { label: 'が row', floor: 3, has: includesAny('がぎぐげご') },
  { label: 'ざ row', floor: 3, has: includesAny('ざじずぜぞ') },
  { label: 'だ row', floor: 3, has: includesAny('だぢづでど') },
  { label: 'ば row', floor: 3, has: includesAny('ばびぶべぼ') },
  { label: 'ぱ row', floor: 3, has: includesAny('ぱぴぷぺぽ') },
  { label: 'combination sounds', floor: 5, has: includesAny('ゃゅょ') },
  { label: 'small っ', floor: 5, has: includesAny('っ') },
  { label: 'long vowels', floor: 5, has: hasLongVowel },
];

function includesAny(chars: string) {
  return (s: string) => [...chars].some((c) => s.includes(c));
}

/**
 * Every rule the outline must satisfy, as a list of what is wrong (empty when
 * it holds). Pure, so CI checks the real spec with no database.
 */
export function validateOutline(spec: OutlineSpec): string[] {
  const errors: string[] = [];
  const lessons = spec.chapters.flatMap((c) => c.lessons);

  const seen = new Set<string>();
  for (const id of [
    ...spec.chapters.map((c) => c.id),
    ...lessons.map((l) => l.id),
  ]) {
    if (seen.has(id)) errors.push(`Duplicate chapter or lesson id: ${id}`);
    seen.add(id);
  }

  const stagesByLesson = new Map(
    lessons.map((l) => [l.id, [] as typeof spec.soundStages]),
  );
  for (const stage of spec.soundStages) {
    const stages = stagesByLesson.get(stage.lessonId);
    if (stages) stages.push(stage);
    else
      errors.push(
        `Sound stage "${stage.label}" names no lesson: ${stage.lessonId}`,
      );
  }

  const chars = new Set<string>();
  const taught = new Set<string>();
  let longVowels = false;

  lessons.forEach((lesson) => {
    for (const itemId of lesson.itemIds) {
      if (kindOf(itemId) === 'kana') {
        const surface = spec.surfaces[itemId];
        if (surface) for (const c of kanaChars(surface)) chars.add(c);
      }
    }
    for (const stage of stagesByLesson.get(lesson.id) ?? []) {
      for (const c of kanaChars(stage.chars ?? '')) chars.add(c);
      if (stage.longVowels) longVowels = true;
    }

    const isFoundational = lesson.type.startsWith('F-');
    const wanted = FOUNDATIONAL_KIND[lesson.type];
    for (const itemId of lesson.itemIds) {
      const where = `${lesson.id} (${itemId})`;
      if (wanted && kindOf(itemId) !== wanted) {
        errors.push(
          `${where}: a ${lesson.type} lesson targets only ${wanted} items`,
        );
      }
      if (!isFoundational && !taught.has(itemId)) {
        errors.push(
          `${where}: an integration lesson uses an item not taught yet`,
        );
      }
      if (isKanjiId(itemId)) continue;
      const surface = spec.surfaces[itemId];
      if (surface === undefined) {
        errors.push(`${where}: no surface in the spec`);
        continue;
      }
      if (hasKanji(surface)) {
        errors.push(`${where}: surface "${surface}" contains kanji`);
      }
      for (const c of new Set(kanaChars(surface))) {
        if (!chars.has(c))
          errors.push(`${where}: uses ${c} before it is taught`);
      }
      if (kindOf(itemId) !== 'kana' && !longVowels && hasLongVowel(surface)) {
        errors.push(
          `${where}: "${surface}" has a long vowel before they are taught`,
        );
      }
    }
    if (isFoundational) for (const itemId of lesson.itemIds) taught.add(itemId);
  });

  checkGrammarPrereqs(spec, lessons, errors);
  checkFloors(spec, errors);
  checkHomophones(spec, errors);
  return errors;
}

function checkGrammarPrereqs(
  spec: OutlineSpec,
  lessons: Lesson[],
  errors: string[],
): void {
  const firstTaught = new Map<string, number>();
  lessons.forEach((l, i) => {
    if (l.type !== 'F-Grammar') return;
    for (const id of l.itemIds)
      if (!firstTaught.has(id)) firstTaught.set(id, i);
  });

  lessons.forEach((l, i) => {
    for (const id of l.itemIds) {
      if (kindOf(id) === 'grammar' && !spec.grammarPrereqs[id]) {
        errors.push(`${id}: no entry in grammarPrereqs`);
      }
    }
    for (const prereq of spec.grammarPrereqs[l.id] ?? []) {
      if ((firstTaught.get(prereq) ?? Infinity) >= i) {
        errors.push(`${l.id}: needs ${prereq} taught before it`);
      }
    }
  });

  for (const [id, prereqs] of Object.entries(spec.grammarPrereqs)) {
    const at = firstTaught.get(id);
    if (at === undefined) continue;
    for (const prereq of prereqs) {
      if ((firstTaught.get(prereq) ?? Infinity) > at) {
        errors.push(`${id}: needs ${prereq} taught first`);
      }
    }
  }
}

function checkFloors(spec: OutlineSpec, errors: string[]): void {
  const words = Object.entries(spec.surfaces)
    .filter(([id]) => kindOf(id) === 'vocab')
    .map(([, surface]) => toHiraganaChars(surface));
  for (const { label, floor, has } of SOUND_FLOORS) {
    const found = words.filter(has).length;
    if (found < floor) {
      errors.push(
        `Coverage: ${label} has ${found} word(s), the floor is ${floor}`,
      );
    }
  }
}

/** Two meaning questions must never read the same (G.4.c). */
function checkHomophones(spec: OutlineSpec, errors: string[]): void {
  const bySurface = new Map<string, string[]>();
  for (const [id, surface] of Object.entries(spec.surfaces)) {
    if (kindOf(id) !== 'vocab' && kindOf(id) !== 'grammar') continue;
    bySurface.set(surface, [...(bySurface.get(surface) ?? []), id]);
  }
  for (const [surface, ids] of bySurface) {
    if (ids.length < 2) continue;
    // A word needs a context entry; grammar keeps its plain prompt.
    const contexts = ids.map((id) =>
      kindOf(id) === 'vocab' ? HOMOPHONE_CONTEXT[displayFromId(id)] : '',
    );
    const told = contexts.every((c) => c !== undefined);
    if (!told || new Set(contexts).size < ids.length) {
      errors.push(
        `Homophone: ${ids.join(' and ')} all read "${surface}" with no context to tell them apart`,
      );
    }
  }
}

export type OutlineItemRow = {
  id: string;
  type: ItemType;
  display: string;
  reading: string | null;
};

/** Item ids the outline names, in lesson order. */
export const outlineItemIds = (spec: OutlineSpec): string[] => [
  ...new Set(spec.chapters.flatMap((c) => c.lessons.flatMap((l) => l.itemIds))),
];

/**
 * The skeleton the rest of the pipeline reads. Throws if a named item has no
 * row, or a row would be served differently from what the spec promises.
 */
export function compile(
  spec: OutlineSpec,
  rows: OutlineItemRow[],
  now: Date = new Date(),
): Skeleton {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const problems: string[] = [];
  for (const id of outlineItemIds(spec)) {
    const row = byId.get(id);
    if (!row) {
      problems.push(`No item row for ${id}`);
    } else if (!isKanjiId(id) && learnerSurface(row) !== spec.surfaces[id]) {
      problems.push(
        `${id}: the row is served as "${learnerSurface(row)}", the spec says "${spec.surfaces[id]}"`,
      );
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `The outline doesn't match the item table (${problems.length}):\n  ${problems.join('\n  ')}`,
    );
  }
  return SkeletonSchema.parse({
    module: { ...spec.module, chapters: spec.chapters },
    generatedAt: now.toISOString(),
    model: COMPILED_OUTLINE_MODEL,
    tokenUsage: { inputTokens: 0, outputTokens: 0 },
    surfaces: spec.surfaces,
    soundStages: spec.soundStages,
  });
}
