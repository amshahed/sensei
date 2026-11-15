import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { toHiragana, toRomaji } from 'wanakana';
import {
  ANSWER_SEPARATORS,
  answerRomaji,
  answerWords,
  isLoneKana,
  SPOKEN,
} from '../common/answer-romaji';
import { ANSWER_PUNCTUATION } from '../common/japanese-script';
import {
  buildTokenizer,
  type JapaneseTokenizer,
} from '../common/japanese-tokenizer';

/** Never part of an answer: こんにちは。 is こんにちは (N6, H.2.c). */
const PUNCTUATION = new RegExp(`[${ANSWER_PUNCTUATION}]`, 'g');

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

/** A typed answer stored in rōmaji: Latin letters and no Japanese at all. */
const isRomajiAnswer = (s: string) =>
  /[a-z]/i.test(s) && !/[぀-ヿ㐀-鿿]/.test(s);

/**
 * The kana a check's prompt shows, as candidates for the kana of an answer
 * stored in rōmaji (B.2.b): each run of kana words, then each word in it.
 */
function kanaCandidates(prompt: string): string[] {
  const runs = prompt.match(/[ぁ-ゖァ-ヺー]+(?:\s+[ぁ-ゖァ-ヺー]+)*/g) ?? [];
  return [...new Set(runs.flatMap((run) => [run, ...run.split(/\s+/)]))];
}

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

/** A typed answer as the learner sees it after a miss (B.2.a). */
export interface AnswerForms {
  kana: string;
  romaji: string;
}

/**
 * Japanese writing-answer evaluation (H.2).
 *
 * Exact-match path for closed TYPED checks:
 *   1. Normalize: romaji/katakana → hiragana (wanakana), collapse whitespace,
 *      drop punctuation (H.2.c).
 *   2. Tokenize: kuromoji morpheme split → surface forms joined.
 *   3. Compare the joined token strings so whitespace in the learner's input
 *      doesn't cause false negatives (e.g. "ねこ が いる" == "ねこがいる").
 *   4. Rōmaji input only: accept は, へ and を typed as they sound (H.2.a).
 *
 * Open TYPED checks (no fixed answer) are AI-graded by GradingService.
 */
@Injectable()
export class WritingEvalService implements OnModuleInit {
  private readonly logger = new Logger(WritingEvalService.name);
  private tokenizer: JapaneseTokenizer | null = null;

  async onModuleInit() {
    try {
      this.tokenizer = await buildTokenizer();
      this.logger.log('Kuromoji tokenizer ready.');
    } catch (err) {
      this.logger.error(
        `Kuromoji failed to load — falling back to whitespace removal: ${String(err)}`,
      );
    }
  }

  /**
   * Romaji → hiragana, katakana → hiragana, trim, collapse spaces. ー becomes
   * the vowel it holds (H.2.d), so ノート is のおと, as nooto and no-to type,
   * and never のうと, which wanakana makes of it and which spells nouto.
   */
  normalizeJapanese(text: string): string {
    return spellLongVowels(
      toHiragana(text.trim().replace(/\s+/g, ' '), {
        convertLongVowelMark: false,
      }),
    );
  }

  /**
   * Split text into morpheme surface forms.
   * Falls back to character array if the tokenizer isn't ready — still supports
   * whitespace-insensitive comparison since spaces aren't Japanese characters.
   */
  private tokenize(text: string): string[] {
    if (this.tokenizer) {
      return this.tokenizer
        .tokenize(text)
        .map((t) => t.surface_form)
        .filter((s) => !/^\s+$/.test(s));
    }
    return text.replace(/\s/g, '').split('');
  }

  /**
   * Exact-match comparison for closed TYPED checks (H.2).
   * Normalizes both sides (romaji/katakana → hiragana) and compares joined
   * token strings so spacing and punctuation differences don't cause false
   * negatives. Rōmaji input also passes when it spells a particle as it sounds
   * (H.2.a), except for a lone kana when `kanaTarget` says the check is on the
   * kana itself.
   */
  exactMatch(
    answer: string,
    exemplar: string,
    { kanaTarget = false }: { kanaTarget?: boolean } = {},
  ): boolean {
    const normAnswer = this.normalizeJapanese(answer);
    const normExemplar = this.normalizeJapanese(exemplar);
    const joinedAnswer = this.tokenize(
      normAnswer.replace(PUNCTUATION, ''),
    ).join('');
    const joinedExemplar = this.tokenize(
      normExemplar.replace(PUNCTUATION, ''),
    ).join('');
    if (joinedAnswer === joinedExemplar) return true;
    return (
      /[a-z]/i.test(answer) &&
      matchesSpoken(normAnswer, normExemplar, kanaTarget)
    );
  }

  /**
   * The answer to a closed typed check in kana and in rōmaji, shown after a
   * miss (B.2.b). Kana stored: the answer as written, and its rōmaji from the
   * shared table. Rōmaji stored: the kana is the first run of kana in the
   * prompt that the grader takes for the answer. Null unless the grader
   * accepts both forms against the stored answer, so the app never shows a
   * spelling the learner would be marked wrong for.
   */
  answerForms(
    answer: string,
    {
      kanaTarget = false,
      prompt = '',
    }: { kanaTarget?: boolean; prompt?: string },
  ): AnswerForms | null {
    const stored = answer.trim();
    const opts = { kanaTarget };
    const romajiStored = isRomajiAnswer(stored);
    const kana = romajiStored
      ? kanaCandidates(prompt).find((c) => this.exactMatch(stored, c, opts))
      : stored;
    const romaji = romajiStored
      ? stored.toLowerCase().replace(/\s+/g, ' ')
      : answerRomaji(stored, opts);
    if (!kana || !romaji) return null;
    const accepted =
      this.exactMatch(romaji, stored, opts) &&
      this.exactMatch(kana, stored, opts);
    return accepted ? { kana, romaji } : null;
  }
}
