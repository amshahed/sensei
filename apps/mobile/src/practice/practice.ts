import type { ItemType, ItemTypeCounts } from '@sensei/types';

export const ITEM_TYPES: readonly ItemType[] = [
  'KANA',
  'VOCAB',
  'KANJI',
  'GRAMMAR',
];

export const TYPE_LABELS = {
  KANA: 'Kana',
  VOCAB: 'Vocab',
  KANJI: 'Kanji',
  GRAMMAR: 'Grammar',
} satisfies Record<ItemType, string>;

/** Learned items matching the type filter (an empty filter = every type). */
export function countFor(
  counts: ItemTypeCounts,
  types: ReadonlySet<ItemType>,
): number {
  return ITEM_TYPES.filter((t) => types.size === 0 || types.has(t)).reduce(
    (n, t) => n + counts[t],
    0,
  );
}
