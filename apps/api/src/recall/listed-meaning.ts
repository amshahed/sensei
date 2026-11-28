/**
 * Whether a typed meaning is one of an item's listed meanings (G.4.h), so it
 * can be marked right without the AI grader. Every rule is a dictionary
 * convention, never a judgement of English or Japanese:
 *
 *  - the listed meanings are the stored meaning's ";"-separated senses
 *    (JMdict's), never its commas or sentences;
 *  - only letters and digits are compared, lowercased: case, spacing and
 *    punctuation are ignored ("Im sorry" = "I'm sorry", "10000" = "10,000");
 *  - each bracketed part may be left out or typed without its brackets
 *    ("water" or "water esp cool or cold" for "water (esp. cool or cold)");
 *  - a leading "to", JMdict's verb marker, may be left out ("eat" for "to eat").
 *
 * Anything else (articles, typos, synonyms, number spellings) is left to the
 * grader. An answer with no letters or digits never matches.
 */
export function isListedMeaning(answer: string, meaning: string): boolean {
  const typed = key(answer);
  if (!typed) return false;
  return meaning.split(';').some((sense) => senseKeys(sense).has(typed));
}

/** Above this many bracketed parts, only "all dropped" and "all kept" count. */
const MAX_BRACKET_PARTS = 6;

/** Innermost `( … )` parts; each one's content is the capture group. */
const BRACKET_PARTS = /\(([^()]*)\)/g;

/** The lowercased words of a text: its runs of letters and digits. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** The comparison key: the words with nothing between them. */
function key(text: string): string {
  return words(text).join('');
}

/** Every key one sense accepts, without the empty key. */
function senseKeys(sense: string): Set<string> {
  const keys = new Set<string>();
  for (const variant of bracketVariants(sense)) {
    const w = words(variant);
    keys.add(w.join(''));
    if (w[0] === 'to' && w.length > 1) keys.add(w.slice(1).join(''));
  }
  keys.delete('');
  return keys;
}

/**
 * A sense with each innermost bracketed part independently dropped or kept
 * without its brackets: 2^n variants for n parts, or just the two extremes
 * above {@link MAX_BRACKET_PARTS}.
 */
function bracketVariants(sense: string): string[] {
  // With a capture group, split alternates text and bracket contents:
  // [text, part, text, part, …, text].
  const pieces = sense.split(BRACKET_PARTS);
  const parts = (pieces.length - 1) / 2;
  const build = (keep: (part: number) => boolean) =>
    pieces
      .map((piece, i) => (i % 2 === 0 || keep((i - 1) / 2) ? piece : ''))
      .join('');
  if (parts > MAX_BRACKET_PARTS) {
    return [build(() => false), build(() => true)];
  }
  const variants: string[] = [];
  for (let mask = 0; mask < 2 ** parts; mask++) {
    variants.push(build((part) => (mask & (1 << part)) !== 0));
  }
  return variants;
}
