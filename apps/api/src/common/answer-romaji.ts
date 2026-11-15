import { toHiragana, toRomaji } from 'wanakana';
import { ANSWER_PUNCTUATION, hasKanji, isKanaOnly } from './japanese-script';

/** Each held-vowel mark, with the kana before it (H.2.d). */
const LONG_VOWEL_MARK = /([ぁ-ゖ])(ー+)/g;
const VOWEL_KANA: Record<string, string> = {
  a: 'あ',
  i: 'い',
  u: 'う',
  e: 'え',
  o: 'お',
};

/**
 * ー spelled as the vowel it holds, so ノー is のお: what nooto and no-to type
 * (H.2.d). A ー after a kana with no vowel (ん, っ) is left as it is.
 */
function spellLongVowels(hiragana: string): string {
  return hiragana.replace(LONG_VOWEL_MARK, (match, kana: string, marks) => {
    const vowel = VOWEL_KANA[toRomaji(kana).at(-1) ?? ''];
    return vowel ? kana + vowel.repeat(String(marks).length) : match;
  });
}

/**
 * A typed answer as grading compares it: rōmaji and katakana to hiragana,
 * trimmed, spaces collapsed. ー becomes the vowel it holds (H.2.d), so ノート
 * is のおと, as nooto and no-to type, and never のうと, which wanakana makes
 * of it and which spells nouto.
 */
export function normalizeJapanese(text: string): string {
  return spellLongVowels(
    toHiragana(text.trim().replace(/\s+/g, ' '), {
      convertLongVowelMark: false,
    }),
  );
}

/** A typed answer stored in rōmaji: Latin letters and no kana or kanji. */
export const isRomajiAnswer = (s: string): boolean =>
  /[a-z]/i.test(s) && !/[ぁ-ゖァ-ヺー]/.test(s) && !hasKanji(s);

/**
 * The kana a check's prompt shows, as candidates for the kana of an answer
 * stored in rōmaji (B.2.b): each run of kana words, then each word in it.
 */
export function kanaCandidates(prompt: string): string[] {
  const runs: string[] =
    prompt.match(/[ぁ-ゖァ-ヺー]+(?:\s+[ぁ-ゖァ-ヺー]+)*/g) ?? [];
  return [...new Set(runs.flatMap((run) => [run, ...run.split(/\s+/)]))];
}

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
 * (は is wa), and every other word as wanakana spells it once ー is the vowel
 * it holds (きっぷ is kippu, ノート is nooto, らーめん is raamen, never
 * ra-men). Null when a word isn't kana only (kanji, Latin letters), because
 * there is then no one rōmaji for it.
 */
export function answerRomaji(
  answer: string,
  { kanaTarget = false }: { kanaTarget?: boolean } = {},
): string | null {
  const words = answerWords(answer);
  if (words.length === 0 || !words.every(isKanaOnly)) return null;
  const literal = isLoneKana(words, kanaTarget);
  return words
    .map(
      (w) => (!literal && SPOKEN[w]?.romaji) || toRomaji(normalizeJapanese(w)),
    )
    .join(' ');
}

/** Never part of an answer: こんにちは。 is こんにちは (N6, H.2.c). */
const PUNCTUATION = new RegExp(`[${ANSWER_PUNCTUATION}]`, 'g');

/**
 * Whole words only, so wana stays wrong for はな. Each position is independent,
 * so watashi wa hon wo yomimasu passes. On a check of a kana item, an answer
 * that is one kana is that character, so は is ha and wa stays wrong.
 */
function matchesSpoken(
  answer: string,
  exemplar: string,
  kanaTarget: boolean,
): boolean {
  const words = answerWords(exemplar);
  const literal = isLoneKana(words, kanaTarget);
  const pattern = words
    .map(
      (w) =>
        (!literal && SPOKEN[w]?.pattern) ||
        w.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&'),
    )
    .join('');
  return new RegExp(`^${pattern}$`).test(answer.replace(ANSWER_SEPARATORS, ''));
}

/**
 * Whether a typed answer matches a stored one (H.2): both normalized, then
 * compared without spaces and punctuation, and rōmaji input may spell a
 * particle as it sounds (H.2.a). `join` is how the grader splits and rejoins
 * the text; the default, dropping whitespace, is what it does without its
 * tokenizer, so the authoring gate, which has none, judges as grading does.
 */
export function typedAnswersMatch(
  answer: string,
  exemplar: string,
  {
    kanaTarget = false,
    join = (s: string) => s.replace(/\s/g, ''),
  }: { kanaTarget?: boolean; join?: (s: string) => string } = {},
): boolean {
  const normAnswer = normalizeJapanese(answer);
  const normExemplar = normalizeJapanese(exemplar);
  const joined = (s: string) => join(s.replace(PUNCTUATION, ''));
  if (joined(normAnswer) === joined(normExemplar)) return true;
  return (
    /[a-z]/i.test(answer) && matchesSpoken(normAnswer, normExemplar, kanaTarget)
  );
}

/** A typed answer as the learner sees it after a miss (B.2.a). */
export interface AnswerForms {
  kana: string;
  romaji: string;
}

/**
 * The kana and rōmaji a closed typed answer is shown with (B.2.b), before the
 * grader's own check of them. Kana stored: the answer as written, and its
 * rōmaji. Rōmaji stored: the first run of kana in the prompt that `match`
 * takes for the answer, and the answer itself. Null when there is no one form
 * of each. The app and the authoring gate both take the forms from here.
 */
export function answerFormsOf(
  answer: string,
  {
    kanaTarget = false,
    prompt = '',
    match = (typed, stored) => typedAnswersMatch(typed, stored, { kanaTarget }),
  }: {
    kanaTarget?: boolean;
    prompt?: string;
    match?: (typed: string, stored: string) => boolean;
  } = {},
): AnswerForms | null {
  const stored = answer.trim();
  if (isRomajiAnswer(stored)) {
    const kana = kanaCandidates(prompt).find((c) => match(stored, c));
    return kana
      ? { kana, romaji: stored.toLowerCase().replace(/\s+/g, ' ') }
      : null;
  }
  const romaji = answerRomaji(stored, { kanaTarget });
  return romaji ? { kana: stored, romaji } : null;
}
