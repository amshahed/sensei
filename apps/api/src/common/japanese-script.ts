import { isKana } from 'wanakana';

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
