import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { toHiragana } from 'wanakana';
import {
  buildTokenizer,
  type JapaneseTokenizer,
} from '../common/japanese-tokenizer';

/** は, へ and を as spoken, and how rōmaji usually spells them (H.2.a). */
const SPOKEN: Record<string, string> = {
  は: '[はわ]',
  へ: '[へえ]',
  を: '[をお]',
  こんにちは: 'こんにち[はわ]',
  こんばんは: 'こんばん[はわ]',
};
const SEPARATORS = /[\s、。,.!?！？]/g;

/**
 * Whole words only, so wana stays wrong for はな. Each position is independent,
 * so watashi wa hon wo yomimasu passes.
 */
function matchesSpoken(answer: string, exemplar: string): boolean {
  const pattern = exemplar
    .split(SEPARATORS)
    .filter(Boolean)
    .map((w) => SPOKEN[w] ?? w.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&'))
    .join('');
  return new RegExp(`^${pattern}$`).test(answer.replace(SEPARATORS, ''));
}

/**
 * Japanese writing-answer evaluation (H.2).
 *
 * Exact-match path for closed TYPED checks:
 *   1. Normalize: romaji/katakana → hiragana (wanakana), collapse whitespace.
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

  /** Romaji → hiragana, katakana → hiragana, trim, collapse spaces. */
  normalizeJapanese(text: string): string {
    return toHiragana(text.trim().replace(/\s+/g, ' '));
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
   * token strings so spacing differences don't cause false negatives. Rōmaji
   * input also passes when it spells a particle as it sounds (H.2.a), unless
   * `spokenParticles` is false: a check on the kana は itself wants ha, not wa.
   */
  exactMatch(
    answer: string,
    exemplar: string,
    { spokenParticles = true }: { spokenParticles?: boolean } = {},
  ): boolean {
    const normAnswer = this.normalizeJapanese(answer);
    const normExemplar = this.normalizeJapanese(exemplar);
    const joinedAnswer = this.tokenize(normAnswer).join('');
    const joinedExemplar = this.tokenize(normExemplar).join('');
    if (joinedAnswer === joinedExemplar) return true;
    return (
      spokenParticles &&
      /[a-z]/i.test(answer) &&
      matchesSpoken(normAnswer, normExemplar)
    );
  }
}
