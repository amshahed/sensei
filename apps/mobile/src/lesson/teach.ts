/**
 * Shape of the authored Teach-beat content (mirrors the seed in
 * apps/api/prisma/seed.ts). The API ships `teach` as `unknown`; the player
 * narrows it through this lightweight, defensive parser so a malformed block
 * never crashes the screen.
 */
export type TeachBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'kana'; itemId: string; char: string; romaji: string; hint?: string };

export function parseTeachBlocks(teach: unknown): TeachBlock[] {
  if (!teach || typeof teach !== 'object') return [];
  const blocks = (teach as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocks)) return [];

  // Validate the fields each kind actually renders, not just the discriminant —
  // a `kana` block missing char/romaji would otherwise render blank rows.
  return blocks.filter((b): b is TeachBlock => {
    if (!b || typeof b !== 'object') return false;
    const r = b as Record<string, unknown>;
    switch (r.kind) {
      case 'heading':
      case 'text':
        return typeof r.text === 'string';
      case 'kana':
        return typeof r.char === 'string' && typeof r.romaji === 'string';
      default:
        return false;
    }
  });
}
