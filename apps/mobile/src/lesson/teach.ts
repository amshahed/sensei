/**
 * Shape of the authored Teach-beat content stored in the DB. The API ships
 * `teach` as `unknown`; the player narrows it through this defensive parser so
 * a malformed block never crashes the screen.
 *
 * Two block formats coexist:
 *  - "runtime" format (seed + legacy): discriminant field is `kind`
 *  - "authoring" format (AI drafter): discriminant field is `type`
 * The parser accepts either, normalising everything to `kind` for rendering.
 */
export type TeachBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'kana'; itemId?: string; char: string; romaji: string; hint?: string }
  /** Reading passage displayed as a card before comprehension checks (H.4). */
  | { kind: 'passage'; text: string; title?: string }
  /** Japanese example sentence with reading and translation (authoring output). */
  | { kind: 'example'; japanese: string; reading: string; translation: string }
  /** Memory hook for a vocab/kana item (authoring output). */
  | { kind: 'mnemonic'; text: string };
// `audio` blocks from the authoring schema are skipped here until Azure TTS
// is wired (#10).

export function parseTeachBlocks(teach: unknown): TeachBlock[] {
  if (!teach || typeof teach !== 'object') return [];
  const blocks = (teach as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocks)) return [];

  return blocks.flatMap((b): TeachBlock[] => {
    if (!b || typeof b !== 'object') return [];
    const r = b as Record<string, unknown>;
    // Accept either discriminant field so both the seed (kind) and the
    // authoring drafter output (type) work without a separate transform.
    const kind = typeof r.kind === 'string' ? r.kind : typeof r.type === 'string' ? r.type : '';

    switch (kind) {
      case 'heading':
        return typeof r.text === 'string' ? [{ kind: 'heading', text: r.text }] : [];

      case 'text': {
        // `text` is the canonical field; `md` is kept as a legacy fallback for
        // any records written before the md→text rename in lesson-schema.ts.
        const text =
          typeof r.text === 'string' ? r.text : typeof r.md === 'string' ? r.md : null;
        return text !== null ? [{ kind: 'text', text }] : [];
      }

      case 'kana':
        return typeof r.char === 'string' && typeof r.romaji === 'string'
          ? [
              {
                kind: 'kana',
                itemId: typeof r.itemId === 'string' ? r.itemId : undefined,
                char: r.char,
                romaji: r.romaji,
                hint: typeof r.hint === 'string' ? r.hint : undefined,
              },
            ]
          : [];

      case 'passage': {
        return typeof r.text === 'string'
          ? [
              {
                kind: 'passage',
                text: r.text,
                title: typeof r.title === 'string' ? r.title : undefined,
              },
            ]
          : [];
      }

      case 'example':
        return typeof r.japanese === 'string' &&
          typeof r.reading === 'string' &&
          typeof r.translation === 'string'
          ? [
              {
                kind: 'example',
                japanese: r.japanese,
                reading: r.reading,
                translation: r.translation,
              },
            ]
          : [];

      case 'mnemonic':
        return typeof r.text === 'string' ? [{ kind: 'mnemonic', text: r.text }] : [];

      // audio: deferred to #10 (Azure TTS). Skip silently.
      case 'audio':
      default:
        return [];
    }
  });
}
