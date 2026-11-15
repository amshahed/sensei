import { toRomaji } from 'wanakana';
import { ANSWER_PUNCTUATION, isKanaOnly } from './japanese-script';

/**
 * は, へ and を as spoken (H.2.a), with こんにちは and こんばんは, which end in
 * one. `pattern` is what grading accepts for the word, `romaji` how the app
 * spells it after a miss (B.2.b). One table, so the spelling shown is always
 * one the grader takes.
 */
export const SPOKEN: Readonly<
  Record<string, { pattern: string; romaji: string }>
> = {
  は: { pattern: '[はわ]', romaji: 'wa' },
  へ: { pattern: '[へえ]', romaji: 'e' },
  を: { pattern: '[をお]', romaji: 'o' },
  こんにちは: { pattern: 'こんにち[はわ]', romaji: 'konnichiwa' },
  こんばんは: { pattern: 'こんばん[はわ]', romaji: 'konbanwa' },
};

/** What splits a typed answer into words: spaces and punctuation (H.2.c). */
export const ANSWER_SEPARATORS = new RegExp(`[\\s${ANSWER_PUNCTUATION}]`, 'g');

/** The words of an answer, as grading reads them. */
export const answerWords = (answer: string): string[] =>
  answer.split(ANSWER_SEPARATORS).filter(Boolean);

/**
 * On a check of a kana item, an answer that is one kana is that character, so
 * は keeps its own sound, ha, and is never the particle (H.2.b).
 */
export const isLoneKana = (words: string[], kanaTarget: boolean): boolean =>
  kanaTarget && words.join('').length === 1;

/**
 * The rōmaji of a typed answer, spelled the way grading accepts it and the
 * lessons teach it (B.2.a, B.2.b): word by word, a spoken word from the table
 * (は is wa) and every other word as wanakana spells it (きっぷ is kippu,
 * ノート is nooto). Null when a word isn't kana only (kanji, Latin letters),
 * because there is then no one rōmaji for it.
 */
export function answerRomaji(
  answer: string,
  { kanaTarget = false }: { kanaTarget?: boolean } = {},
): string | null {
  const words = answerWords(answer);
  if (words.length === 0 || !words.every(isKanaOnly)) return null;
  const literal = isLoneKana(words, kanaTarget);
  return words
    .map((w) => (!literal && SPOKEN[w]?.romaji) || toRomaji(w))
    .join(' ');
}
