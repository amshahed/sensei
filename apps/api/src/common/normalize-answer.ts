/**
 * Normalises a free-text answer for exact-match grading: trims, collapses
 * internal whitespace, lowercases. Deliberately conservative for the
 * deterministic phase — kana/kanji compare as-is (no romaji folding). Fuzzy /
 * AI grading arrives in issue #8.
 */
export function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}
