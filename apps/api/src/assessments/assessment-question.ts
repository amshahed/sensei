import { hasKanji } from '../common/japanese-script';
import {
  type ReviewableItem,
  reviewQuestionFor,
} from '../reviews/review-question';

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

export interface AssessmentQuestion {
  prompt: string;
  /** Shown as the correct answer afterwards. Server-only until then. */
  expected: string;
  /** Every answer that counts as right (`romaji` / `reading`). */
  accepted: string[];
  check: AnswerCheck;
}

function stringArray(data: unknown, key: string): string[] {
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
 * "." separates the stem from okurigana (ひと.つ → ひとつ or ひと).
 */
export function kanjiReadings(item: ReviewableItem): {
  accepted: string[];
  shown: string;
} {
  const on = stringArray(item.data, 'on_readings');
  const kun = stringArray(item.data, 'kun_readings');
  const raw =
    on.length + kun.length > 0 ? [...on, ...kun] : [item.reading ?? ''];
  const accepted = new Set<string>();
  const shown: string[] = [];
  for (const r of raw) {
    const bare = r.replace(/-/g, '').trim();
    if (!bare) continue;
    const [stem, okurigana] = bare.split('.');
    accepted.add(stem);
    if (okurigana) accepted.add(stem + okurigana);
    const label = okurigana ? `${stem}(${okurigana})` : stem;
    if (!shown.includes(label)) shown.push(label);
  }
  return { accepted: [...accepted], shown: shown.join('・') };
}

/**
 * The chapter Assessment question for one item (decisions.md I.4.d.a): typed
 * recall built from item data the way Reviews are (G.4). No question may
 * answer itself: a kana-only word asks for its meaning (its reading *is* the
 * prompt), and an item without a usable answer is not assessable (null).
 */
export function assessmentQuestionFor(
  item: ReviewableItem,
): AssessmentQuestion | null {
  if (item.type === 'VOCAB' && !hasKanji(item.display)) {
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
  if (item.type === 'KANJI') {
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
  const { prompt, expectedAnswer } = reviewQuestionFor(item);
  const expected = expectedAnswer.trim();
  if (!expected || expected === item.display) return null;
  return {
    prompt,
    expected,
    accepted: [expected],
    check:
      item.type === 'KANA'
        ? 'romaji'
        : item.type === 'GRAMMAR'
          ? 'meaning'
          : 'reading',
  };
}

/**
 * Sample up to `size` entries spread across groups (one per lesson): lessons
 * are visited in a shuffled order, taking one random entry from each per
 * round, so a short test still touches as many lessons as possible.
 */
export function sampleAcrossGroups<T>(
  groups: readonly (readonly T[])[],
  size: number,
  random: () => number,
): T[] {
  const pools = shuffle(
    groups.filter((g) => g.length > 0).map((g) => shuffle([...g], random)),
    random,
  );
  const out: T[] = [];
  while (out.length < size && pools.some((p) => p.length > 0)) {
    for (const pool of pools) {
      if (out.length >= size) break;
      const next = pool.pop();
      if (next !== undefined) out.push(next);
    }
  }
  return out;
}

function shuffle<T>(arr: T[], random: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
