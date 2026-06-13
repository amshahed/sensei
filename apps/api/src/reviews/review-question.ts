import type { ItemType } from '@sensei/types';

/** The minimal item shape needed to build a review question. */
export interface ReviewableItem {
  type: ItemType;
  display: string;
  reading: string | null;
  meaning: string | null;
  data: unknown;
}

export interface ReviewQuestion {
  /** Shown to the learner. */
  prompt: string;
  /** Graded against (server-only). */
  expectedAnswer: string;
}

function dataString(data: unknown, key: string): string | undefined {
  if (data && typeof data === 'object') {
    const v = (data as Record<string, unknown>)[key];
    if (typeof v === 'string') return v;
  }
  return undefined;
}

/**
 * Derives a deterministic recall question for an item (G.4 reviews exercise the
 * weakest modality; the deterministic phase uses typed recall). Kana ask for
 * rōmaji (the kana *is* its own reading, so that would be trivial); vocab/kanji
 * ask for the kana reading; grammar asks for the meaning. AI-generated, modality-
 * varied review prompts arrive with #8.
 */
export function reviewQuestionFor(item: ReviewableItem): ReviewQuestion {
  switch (item.type) {
    case 'KANA':
      return {
        prompt: `Type the rōmaji for 「${item.display}」`,
        expectedAnswer: dataString(item.data, 'romaji') ?? item.reading ?? '',
      };
    case 'VOCAB':
    case 'KANJI':
      return {
        prompt: `Type the reading for 「${item.display}」`,
        expectedAnswer: item.reading ?? item.display,
      };
    case 'GRAMMAR':
      return {
        prompt: `What does 「${item.display}」 mean?`,
        expectedAnswer: item.meaning ?? '',
      };
  }
}
