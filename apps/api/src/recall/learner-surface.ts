import type { ItemType } from '@sensei/types';
import { hasKanji } from '../common/japanese-script';

/**
 * What a learner sees for an item (G.4.c). Beta vocabulary is always shown in
 * kana, because most of its kanji are never taught. `Item.display` keeps the
 * canonical spelling, so reversing this is a change to this function alone.
 */
export function learnerSurface(item: {
  type: ItemType;
  display: string;
  reading: string | null;
}): string {
  if (item.type === 'VOCAB' && hasKanji(item.display)) {
    return item.reading?.trim() || item.display;
  }
  // The Tanos pattern is "stem +たいです"; a beginner shouldn't meet "stem".
  if (item.type === 'GRAMMAR') return item.display.replace(/^stem \+/, '〜');
  return item.display;
}

/**
 * Whether passing a test may schedule an item the learner wasn't asked about
 * (G.4.d). Vocabulary is answered in kana, so a passed chapter says nothing
 * about its kanji: a kanji is scheduled only with evidence (G.4.e).
 */
export function mayInferMastery(item: { type: ItemType }): boolean {
  return item.type !== 'KANJI';
}
