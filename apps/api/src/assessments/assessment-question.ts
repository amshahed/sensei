import { hasKanji } from '../common/japanese-script';
import {
  type ReviewableItem,
  reviewQuestionFor,
} from '../reviews/review-question';

/**
 * How an answer is checked:
 *  - `romaji`: kana → rōmaji, plain exact match (Japanese normalisation would
 *    accept the kana itself, which is shown in the prompt).
 *  - `reading`: vocab / kanji → kana reading; Japanese-normalised exact match,
 *    so rōmaji or katakana input counts (H.2).
 *  - `meaning`: free-text meaning, graded by the AI open-answer grader with
 *    the item's meaning as the exemplar (G.3).
 */
export type AnswerCheck = 'romaji' | 'reading' | 'meaning';

export interface AssessmentQuestion {
  prompt: string;
  /** Server-only. */
  expected: string;
  check: AnswerCheck;
}

/**
 * The chapter Assessment question for one item (decisions.md I.4.d.a): typed
 * recall built from item data the way Reviews are (G.4). Two refinements so
 * no question answers itself: a kana-only word asks for its meaning (its
 * reading *is* the prompt), and an item whose expected answer is empty or
 * identical to what's shown is not assessable (null).
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
          check: 'meaning',
        }
      : null;
  }
  const { prompt, expectedAnswer } = reviewQuestionFor(item);
  const expected = expectedAnswer.trim();
  if (!expected || expected === item.display) return null;
  const check: AnswerCheck =
    item.type === 'KANA'
      ? 'romaji'
      : item.type === 'GRAMMAR'
        ? 'meaning'
        : 'reading';
  return { prompt, expected, check };
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
