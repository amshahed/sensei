import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import kuromoji from 'kuromoji';
import { toHiragana } from 'wanakana';
import { resolve, dirname } from 'path';

// Resolve via the package itself so the path works regardless of __dirname
// (mono-repo hoisting, compiled dist/, Jest source runs all point here).
const DICT_PATH = resolve(dirname(require.resolve('kuromoji')), '../dict');

/** Surface the kuromoji builder as a promise once so it can be awaited. */
function buildTokenizer(): Promise<
  kuromoji.Tokenizer<kuromoji.IpadicFeatures>
> {
  return new Promise((ok, fail) => {
    kuromoji.builder({ dicPath: DICT_PATH }).build((err, tokenizer) => {
      if (err) fail(err);
      else ok(tokenizer);
    });
  });
}

/**
 * Japanese writing-answer evaluation (H.2).
 *
 * Exact-match path for closed TYPED checks:
 *   1. Normalize: romaji/katakana → hiragana (wanakana), collapse whitespace.
 *   2. Tokenize: kuromoji morpheme split → surface forms joined.
 *   3. Compare the joined token strings so whitespace in the learner's input
 *      doesn't cause false negatives (e.g. "ねこ が いる" == "ねこがいる").
 *
 * Open TYPED checks (no fixed answer) are AI-graded by GradingService.
 */
@Injectable()
export class WritingEvalService implements OnModuleInit {
  private readonly logger = new Logger(WritingEvalService.name);
  private tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null;

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
   * token strings so spacing differences don't cause false negatives.
   */
  exactMatch(answer: string, exemplar: string): boolean {
    const normAnswer = this.normalizeJapanese(answer);
    const normExemplar = this.normalizeJapanese(exemplar);
    const joinedAnswer = this.tokenize(normAnswer).join('');
    const joinedExemplar = this.tokenize(normExemplar).join('');
    return joinedAnswer === joinedExemplar;
  }
}
