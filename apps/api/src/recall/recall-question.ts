import type { Prisma } from '@prisma/client';
import type { ItemType } from '@sensei/types';
import { learnerSurface } from './learner-surface';

/** The minimal item shape needed to build a recall question. */
/** Prisma `select` for exactly the fields {@link recallQuestionFor} reads (plus id). */
export const RECALLABLE_ITEM_SELECT = {
  id: true,
  type: true,
  display: true,
  reading: true,
  meaning: true,
  data: true,
} satisfies Prisma.ItemSelect;

export interface RecallableItem {
  type: ItemType;
  display: string;
  reading: string | null;
  meaning: string | null;
  data: unknown;
}

/**
 * How an answer is checked:
 *  - `romaji`: kana → rōmaji, plain exact match (Japanese normalisation would
 *    accept the kana itself, which is shown in the prompt).
 *  - `reading`: kanji → a kana reading; Japanese-normalised exact match
 *    against any accepted reading, so rōmaji or katakana input counts (H.2).
 *  - `meaning`: free-text meaning, graded by the AI open-answer grader with
 *    the item's meaning as the exemplar (G.3).
 */
export type AnswerCheck = 'romaji' | 'reading' | 'meaning';

export interface RecallQuestion {
  prompt: string;
  /** Shown as the correct answer afterwards. Server-only until then. */
  expected: string;
  /** Every answer that counts as right (`romaji` / `reading`). */
  accepted: string[];
  check: AnswerCheck;
}

export function dataString(data: unknown, key: string): string | undefined {
  if (data && typeof data === 'object') {
    const v = (data as Record<string, unknown>)[key];
    if (typeof v === 'string') return v;
  }
  return undefined;
}

export function dataStrings(data: unknown, key: string): string[] {
  if (data && typeof data === 'object') {
    const v = (data as Record<string, unknown>)[key];
    if (Array.isArray(v)) {
      return v.filter((x): x is string => typeof x === 'string');
    }
  }
  return [];
}

/**
 * One KANJIDIC2 reading, markers resolved: "-" marks a prefix/suffix use
 * (ひと- → ひと), "." separates the stem from okurigana (ひと.つ). `answer` is
 * what a learner types (ひとつ); `label` is how it's shown (ひと(つ)).
 * Null for an empty reading.
 */
export function kanjiReading(
  raw: string,
): { answer: string; label: string } | null {
  const bare = raw.replace(/-/g, '').trim();
  if (!bare) return null;
  const [stem, okurigana] = bare.split('.');
  return okurigana
    ? { answer: stem + okurigana, label: `${stem}(${okurigana})` }
    : { answer: stem, label: stem };
}

/**
 * Readings a learner may give for a kanji: every on'yomi and kun'yomi, with
 * KANJIDIC2's markers resolved — "-" marks a prefix/suffix use (ひと- → ひと),
 * "." separates the stem from okurigana (ひと.つ → ひとつ). The bare stem of a
 * "." reading is NOT accepted: for 生 (い.きる) it would let a lone い pass.
 */
export function kanjiReadings(item: RecallableItem): {
  accepted: string[];
  shown: string;
} {
  const on = dataStrings(item.data, 'on_readings');
  const kun = dataStrings(item.data, 'kun_readings');
  const raw =
    on.length + kun.length > 0 ? [...on, ...kun] : [item.reading ?? ''];
  const accepted = new Set<string>();
  const shown: string[] = [];
  for (const r of raw) {
    const reading = kanjiReading(r);
    if (!reading) continue;
    accepted.add(reading.answer);
    if (!shown.includes(reading.label)) shown.push(reading.label);
  }
  return { accepted: [...accepted], shown: shown.join('・') };
}

/**
 * Words that kana-only display makes identical to another item, keyed by
 * `Item.display`, with the phrase that tells them apart. The outline validator
 * fails on any new collision without an entry here.
 */
export const HOMOPHONE_CONTEXT: Readonly<Record<string, string>> = {
  さん: 'after a name',
  三: 'as a number',
  二: 'as a number',
};

function meaningQuestion(item: RecallableItem): RecallQuestion | null {
  const meaning = item.meaning?.trim();
  const context =
    item.type === 'VOCAB' ? HOMOPHONE_CONTEXT[item.display] : null;
  const asked = context ? ` mean ${context}?` : ' mean?';
  return meaning
    ? {
        prompt: `What does 「${learnerSurface(item)}」${asked}`,
        expected: meaning,
        accepted: [meaning],
        check: 'meaning',
      }
    : null;
}

/**
 * The typed-recall question for one item — shared by Reviews (G.4), chapter
 * Assessments (I.4.d.a) and Practice (J.1.c), so every surface asks and grades
 * the same way. No question may answer itself: a word is shown in kana, so it
 * asks for its meaning (G.4.c), and an item without a usable answer (e.g. a
 * grammar shell with no meaning yet) is not quizzable (null).
 */
export function recallQuestionFor(item: RecallableItem): RecallQuestion | null {
  switch (item.type) {
    case 'KANA': {
      const romaji = dataString(item.data, 'romaji')?.trim();
      return romaji
        ? {
            prompt: `Type the rōmaji for 「${item.display}」`,
            expected: romaji,
            accepted: [romaji],
            check: 'romaji',
          }
        : null;
    }
    case 'VOCAB':
      return meaningQuestion(item);
    case 'KANJI': {
      const { accepted, shown } = kanjiReadings(item);
      return accepted.length > 0
        ? {
            prompt: `Type a reading for 「${item.display}」`,
            expected: shown,
            accepted,
            check: 'reading',
          }
        : null;
    }
    case 'GRAMMAR':
      return meaningQuestion(item);
  }
}
