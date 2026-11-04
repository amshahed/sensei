import type { Prisma } from '@prisma/client';
import type { ItemType } from '@sensei/types';
import { hasKanji } from '../common/japanese-script';

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
 *  - `reading`: vocab / kanji → a kana reading; Japanese-normalised exact match
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

function dataString(data: unknown, key: string): string | undefined {
  if (data && typeof data === 'object') {
    const v = (data as Record<string, unknown>)[key];
    if (typeof v === 'string') return v;
  }
  return undefined;
}

function dataStrings(data: unknown, key: string): string[] {
  if (data && typeof data === 'object') {
    const v = (data as Record<string, unknown>)[key];
    if (Array.isArray(v)) {
      return v.filter((x): x is string => typeof x === 'string');
    }
  }
  return [];
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
    const bare = r.replace(/-/g, '').trim();
    if (!bare) continue;
    const [stem, okurigana] = bare.split('.');
    accepted.add(okurigana ? stem + okurigana : stem);
    const label = okurigana ? `${stem}(${okurigana})` : stem;
    if (!shown.includes(label)) shown.push(label);
  }
  return { accepted: [...accepted], shown: shown.join('・') };
}

function meaningQuestion(item: RecallableItem): RecallQuestion | null {
  const meaning = item.meaning?.trim();
  return meaning
    ? {
        prompt: `What does 「${item.display}」 mean?`,
        expected: meaning,
        accepted: [meaning],
        check: 'meaning',
      }
    : null;
}

/**
 * The typed-recall question for one item — shared by Reviews (G.4), chapter
 * Assessments (I.4.d.a) and Practice (J.1.c), so every surface asks and grades
 * the same way. No question may answer itself: a kana-only word asks for its
 * meaning (its reading *is* the prompt), and an item without a usable answer
 * (e.g. a grammar shell with no meaning yet) is not quizzable (null).
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
    case 'VOCAB': {
      const reading = item.reading?.trim();
      if (!hasKanji(item.display) || !reading || reading === item.display) {
        return meaningQuestion(item);
      }
      return {
        prompt: `Type the reading for 「${item.display}」`,
        expected: reading,
        accepted: [reading],
        check: 'reading',
      };
    }
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
