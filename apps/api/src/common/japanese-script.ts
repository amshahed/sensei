import { isKana, toRomaji } from 'wanakana';

/**
 * One definition of "kanji" for the ingest code. wanakana.isKanji misses 〆
 * and CJK Extension A, so this is a regex: CJK Unified + Ext-A + compatibility
 * ideographs, plus the iteration / closing marks 々 〆.
 */
const KANJI_CHAR = /[々〆㐀-䶿一-鿿豈-﫿]/;

/** True when the string contains at least one kanji (人々, 居る, 〆切). */
export const hasKanji = (s: string): boolean => KANJI_CHAR.test(s);

/** True for a non-empty, kana-only string (hiragana / katakana / ー). */
export const isKanaOnly = (s: string): boolean => s.length > 0 && isKana(s);

/** Every kana character in the text, repeated as often as it occurs. */
export const kanaChars = (s: string): string[] =>
  [...s].filter((ch) => isKana(ch));

/** Every kanji character in the text. */
export const kanjiChars = (s: string): string[] =>
  [...s].filter((ch) => KANJI_CHAR.test(ch));

const KATAKANA_START = 0x30a1;
const KATAKANA_END = 0x30f6;
const KANA_OFFSET = 0x60;

/** Katakana mapped to hiragana; everything else (ー included) passes through. */
export const toHiraganaChars = (s: string): string =>
  [...s]
    .map((ch) => {
      const code = ch.codePointAt(0)!;
      return code >= KATAKANA_START && code <= KATAKANA_END
        ? String.fromCodePoint(code - KANA_OFFSET)
        : ch;
    })
    .join('');

const BARE_VOWELS = 'あいうえお';
const vowelOf = (ch: string): string | undefined => {
  const last = toRomaji(ch).at(-1);
  return last && 'aiueo'.includes(last) ? last : undefined;
};

/**
 * Heuristic: a held vowel in a word. ー, or a hiragana vowel that repeats the
 * vowel before it (おかあさん), plus the spellings えい and おう. Reads some
 * compounds wrongly (おうち), so it is a hard rule only on outline words.
 */
export function hasLongVowel(word: string): boolean {
  if (word.includes('ー')) return true;
  const chars = [...word];
  return chars.some((ch, i) => {
    if (i === 0 || !BARE_VOWELS.includes(ch)) return false;
    const before = vowelOf(chars[i - 1]);
    if (!before) return false;
    const held = toRomaji(ch);
    return (
      before === held ||
      (before === 'e' && held === 'i') ||
      (before === 'o' && held === 'u')
    );
  });
}
