import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  answerFormsOf,
  normalizeJapanese,
  typedAnswersMatch,
  type AnswerForms,
} from '../common/answer-romaji';
import {
  buildTokenizer,
  type JapaneseTokenizer,
} from '../common/japanese-tokenizer';

export type { AnswerForms };

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
   * Romaji → hiragana, katakana → hiragana, trim, collapse spaces, and ー as
   * the vowel it holds (H.2.d). Shared with the authoring gate.
   */
  normalizeJapanese(text: string): string {
    return normalizeJapanese(text);
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
    return typedAnswersMatch(answer, exemplar, {
      kanaTarget,
      join: (s) => this.tokenize(s).join(''),
    });
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
    const opts = { kanaTarget };
    const forms = answerFormsOf(answer, {
      kanaTarget,
      prompt,
      match: (typed, stored) => this.exactMatch(typed, stored, opts),
    });
    if (!forms) return null;
    const stored = answer.trim();
    const accepted =
      this.exactMatch(forms.romaji, stored, opts) &&
      this.exactMatch(forms.kana, stored, opts);
    return accepted ? forms : null;
  }
}
