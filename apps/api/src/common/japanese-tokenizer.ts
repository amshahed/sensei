import kuromoji from 'kuromoji';
import { resolve, dirname } from 'path';

export type JapaneseTokenizer = kuromoji.Tokenizer<kuromoji.IpadicFeatures>;

// Resolve via the package itself so the path works regardless of __dirname
// (mono-repo hoisting, compiled dist/, Jest source runs all point here).
const DICT_PATH = resolve(dirname(require.resolve('kuromoji')), '../dict');

/** Build the kuromoji (IPADIC) morphological tokenizer; ~1 s, build once. */
export function buildTokenizer(): Promise<JapaneseTokenizer> {
  return new Promise((ok, fail) => {
    kuromoji.builder({ dicPath: DICT_PATH }).build((err, tokenizer) => {
      if (err) fail(err);
      else ok(tokenizer);
    });
  });
}
