/**
 * Normalises a free-text answer for exact-match grading: trims, collapses
 * internal whitespace, lowercases. Deliberately conservative for the
 * deterministic phase — kana/kanji compare as-is (no romaji folding). Fuzzy /
 * AI grading arrives in issue #8.
 */
export function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Whether two answers match under {@link normalizeAnswer}. The single source of
 * truth for deterministic exact-match grading — used by closed Checks, reviews,
 * and the AI-grading fallback so they can't drift apart (e.g. when romaji
 * folding is added later).
 */
export function exactMatch(a: string, b: string): boolean {
  return normalizeAnswer(a) === normalizeAnswer(b);
}
