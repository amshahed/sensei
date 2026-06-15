import { PrismaClient } from '@prisma/client';
import type { LessonDraft } from './lesson-schema';

export interface ValidationResult {
  pass: boolean;
  errors: string[];
}

const FOUNDATIONAL_ITEM_TYPE: Record<string, string | undefined> = {
  'F-Kana': 'KANA',
  'F-Vocab': 'VOCAB',
  'F-Kanji': 'KANJI',
  'F-Grammar': 'GRAMMAR',
};

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac']);

function isPlaceholderAudioSrc(src: string): boolean {
  const lower = src.toLowerCase();
  const hasAudioExt = [...AUDIO_EXTENSIONS].some((ext) => lower.endsWith(ext));
  const isAbsolute = src.startsWith('/') || /^https?:\/\//i.test(src);
  return hasAudioExt && !isAbsolute;
}

/**
 * Structural validator for lesson drafts (F.3 pre-review gate).
 * Deterministic checks run before the AI critic:
 * 1. All targetItemIds resolve to real DB items
 * 2. All question/template targetItemIds are declared in targetItemIds
 * 3. Lesson-type adherence (F-* lessons constrain item types)
 * 4. Audio block src values are placeholder paths (not absolute URLs)
 *
 * Pass `preloadedItems` when you already have the items from a prior DB query
 * (e.g. from generateDraft) to avoid a redundant round-trip.
 */
export async function validateStructure(
  draft: LessonDraft,
  prisma: PrismaClient,
  preloadedItems?: Array<{ id: string; type: string }>,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const declaredIds = new Set(draft.targetItemIds);

  // 1. All declared targetItemIds must exist in DB
  const items =
    preloadedItems ??
    (await prisma.item.findMany({
      where: { id: { in: draft.targetItemIds } },
      select: { id: true, type: true },
    }));
  const foundIds = new Set(items.map((i) => i.id));
  for (const id of declaredIds) {
    if (!foundIds.has(id)) {
      errors.push(`targetItemId "${id}" not found in DB`);
    }
  }

  // 2. Check question targetItemIds must be declared
  for (const q of draft.check.questions) {
    if (!declaredIds.has(q.targetItemId)) {
      errors.push(
        `check question "${q.id}" references undeclared targetItemId "${q.targetItemId}"`,
      );
    }
  }

  // 3. Practice template targetItemIds must be declared
  for (const t of draft.practice.templates) {
    if (!declaredIds.has(t.targetItemId)) {
      errors.push(
        `practice template for "${t.targetItemId}" references undeclared targetItemId`,
      );
    }
  }

  // 4. Foundational lesson type adherence
  const expectedType = FOUNDATIONAL_ITEM_TYPE[draft.lessonType];
  if (expectedType) {
    for (const item of items) {
      if (item.type !== expectedType) {
        errors.push(
          `lesson type ${draft.lessonType} requires ${expectedType} items but found ${item.type} (${item.id})`,
        );
      }
    }
  }

  // 5. Audio blocks must use placeholder paths (no absolute paths or URLs)
  for (const block of draft.teach.blocks) {
    if (block.type === 'audio' && !isPlaceholderAudioSrc(block.src)) {
      errors.push(
        `teach audio block src "${block.src}" must be a relative placeholder path (e.g. "audio/kana/a.mp3")`,
      );
    }
  }

  return { pass: errors.length === 0, errors };
}
