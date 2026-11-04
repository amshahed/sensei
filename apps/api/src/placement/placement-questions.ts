import type { ItemType, PlacementQuestionDto } from '@sensei/types';
import type { RecallableItem } from '../recall/recall-question';

/** ~2 items per chapter, in course order (I.4.f). */
export const PLACEMENT_PER_CHAPTER = 2;
/** Question budget per tier (I.4.a lengths, I.4.f sampling). */
export const PLACEMENT_BUDGET = { KANA: 24, FULL: 40 } as const;
export type PlacementTier = keyof typeof PLACEMENT_BUDGET;

/** Placement routing by signup Q2 (I.3.d): null = no placement. */
export function placementTierFor(
  priorExperience: string | null,
): PlacementTier | null {
  switch (priorExperience) {
    case 'SOME_KANA':
      return 'KANA';
    case 'FAIR_AMOUNT':
    case 'REFRESHER':
      return 'FULL';
    default:
      return null;
  }
}

/** Item types each tier can ask about (grammar waits for cloze content, I.4.f). */
const TIER_TYPES: Record<PlacementTier, ReadonlySet<ItemType>> = {
  KANA: new Set(['KANA']),
  FULL: new Set(['KANA', 'VOCAB', 'KANJI']),
};

const DISTRACTORS = 3;

export type PlacementItem = RecallableItem & { id: string };

/** A stored question: the DTO plus the chapter it places and each part's answer. */
export interface PlacementQuestion extends PlacementQuestionDto {
  chapterId: string;
  parts: Array<{ label: string | null; choices: string[]; answer: string }>;
}

/** The learner-facing question — answers and chapter stripped. */
export function toQuestionDto(q: PlacementQuestion): PlacementQuestionDto {
  return {
    itemId: q.itemId,
    type: q.type,
    prompt: q.prompt,
    display: q.display,
    parts: q.parts.map(({ label, choices }) => ({ label, choices })),
  };
}

/** Distractor pools, built from every item of the quizzed types. */
export interface DistractorPools {
  /** Kana by script: [character, rōmaji]. */
  kana: Map<string, Array<[string, string]>>;
  vocabMeanings: string[];
  /** Kanji primary readings, split by script so choices don't give it away. */
  kanjiReadings: { katakana: string[]; hiragana: string[] };
  kanjiMeanings: string[];
}

const strings = (data: unknown, key: string): string[] => {
  const v = (data as Record<string, unknown> | null)?.[key];
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string')
    : [];
};
const str = (data: unknown, key: string): string | null => {
  const v = (data as Record<string, unknown> | null)?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};

/** A KANJIDIC2 reading as a learner sees it: 'ひと.つ' → 'ひと(つ)', 'ひと-' → 'ひと'. */
function readingLabel(raw: string): string {
  const bare = raw.replace(/-/g, '').trim();
  const [stem, okurigana] = bare.split('.');
  return okurigana ? `${stem}(${okurigana})` : stem;
}
const isKatakana = (s: string) => /^[゠-ヿ]/.test(s);

export function buildPools(items: PlacementItem[]): DistractorPools {
  const pools: DistractorPools = {
    kana: new Map(),
    vocabMeanings: [],
    kanjiReadings: { katakana: [], hiragana: [] },
    kanjiMeanings: [],
  };
  for (const item of items) {
    if (item.type === 'KANA') {
      const script = str(item.data, 'script');
      const romaji = str(item.data, 'romaji');
      if (!script || !romaji) continue;
      const list = pools.kana.get(script) ?? [];
      list.push([item.display, romaji]);
      pools.kana.set(script, list);
    } else if (item.type === 'VOCAB' && item.meaning?.trim()) {
      pools.vocabMeanings.push(item.meaning.trim());
    } else if (item.type === 'KANJI') {
      if (item.reading?.trim()) {
        const label = readingLabel(item.reading);
        if (label) {
          (isKatakana(label)
            ? pools.kanjiReadings.katakana
            : pools.kanjiReadings.hiragana
          ).push(label);
        }
      }
      if (item.meaning?.trim()) pools.kanjiMeanings.push(item.meaning.trim());
    }
  }
  return pools;
}

/** Pick `n` distinct values from `pool` that aren't in `exclude` (case-insensitive). */
function pickDistractors(
  pool: readonly string[],
  exclude: Iterable<string>,
  random: () => number,
  n = DISTRACTORS,
): string[] | null {
  const taken = new Set([...exclude].map((s) => s.toLowerCase()));
  const candidates = [...new Set(pool)].filter(
    (s) => !taken.has(s.toLowerCase()),
  );
  if (candidates.length < n) return null;
  const out: string[] = [];
  while (out.length < n) {
    const i = Math.floor(random() * candidates.length);
    const [pick] = candidates.splice(i, 1);
    out.push(pick);
  }
  return out;
}

/** The answer placed at a random position among the distractors. */
function withAnswer(
  answer: string,
  distractors: string[],
  random: () => number,
) {
  const choices = [...distractors];
  choices.splice(Math.floor(random() * (choices.length + 1)), 0, answer);
  return { choices, answer };
}

/**
 * The multiple-choice placement question for an item (I.4.b formats), or null
 * when it can't be asked fairly (missing data, or too few distractors).
 */
export function placementQuestionFor(
  item: PlacementItem,
  chapterId: string,
  pools: DistractorPools,
  random: () => number,
): PlacementQuestion | null {
  const base = { itemId: item.id, type: item.type, chapterId };
  switch (item.type) {
    case 'KANA': {
      // Name the script: の and ノ are both "no".
      const script = str(item.data, 'script');
      const romaji = str(item.data, 'romaji');
      if (!script || !romaji) return null;
      const others = (pools.kana.get(script) ?? [])
        .filter(([, r]) => r !== romaji)
        .map(([k]) => k);
      const wrong = pickDistractors(others, [item.display], random);
      if (!wrong) return null;
      return {
        ...base,
        prompt: `Which ${script} is read “${romaji}”?`,
        display: null,
        parts: [{ label: null, ...withAnswer(item.display, wrong, random) }],
      };
    }
    case 'VOCAB': {
      const meaning = item.meaning?.trim();
      if (!meaning) return null;
      const senses = [meaning, ...strings(item.data, 'senses')];
      const wrong = pickDistractors(pools.vocabMeanings, senses, random);
      if (!wrong) return null;
      return {
        ...base,
        prompt: 'What does this word mean?',
        display: item.display,
        parts: [{ label: null, ...withAnswer(meaning, wrong, random) }],
      };
    }
    case 'KANJI': {
      const meaning = item.meaning?.trim();
      const reading = item.reading?.trim() ? readingLabel(item.reading) : '';
      if (!meaning || !reading) return null;
      const ownReadings = [
        ...strings(item.data, 'on_readings'),
        ...strings(item.data, 'kun_readings'),
      ].map(readingLabel);
      const readingPool = isKatakana(reading)
        ? pools.kanjiReadings.katakana
        : pools.kanjiReadings.hiragana;
      const wrongReadings = pickDistractors(
        readingPool,
        [reading, ...ownReadings],
        random,
      );
      const wrongMeanings = pickDistractors(
        pools.kanjiMeanings,
        [meaning, ...strings(item.data, 'meanings')],
        random,
      );
      if (!wrongReadings || !wrongMeanings) return null;
      return {
        ...base,
        prompt: 'What is the reading and meaning of this kanji?',
        display: item.display,
        parts: [
          { label: 'Reading', ...withAnswer(reading, wrongReadings, random) },
          { label: 'Meaning', ...withAnswer(meaning, wrongMeanings, random) },
        ],
      };
    }
    default:
      // GRAMMAR: cloze content doesn't exist yet (I.4.f).
      return null;
  }
}

/** A chapter in course order with the items it is the first to teach. */
export interface PlacementChapter {
  id: string;
  items: PlacementItem[];
}

/**
 * Course-order sampling (I.4.f): up to {@link PLACEMENT_PER_CHAPTER} askable
 * items per chapter, chapter by chapter, until the tier's budget is spent.
 * Within a chapter the picks keep teaching order.
 */
export function samplePlacement(
  chapters: PlacementChapter[],
  tier: PlacementTier,
  pools: DistractorPools,
  random: () => number,
): PlacementQuestion[] {
  const budget = PLACEMENT_BUDGET[tier];
  const out: PlacementQuestion[] = [];
  for (const chapter of chapters) {
    if (out.length >= budget) break;
    const askable = chapter.items.filter((i) => TIER_TYPES[tier].has(i.type));
    const picks: Array<{ index: number; question: PlacementQuestion }> = [];
    const order = askable.map((_, i) => i);
    // Partial Fisher–Yates: try items in random order until we have enough.
    for (
      let k = 0;
      k < order.length &&
      picks.length < Math.min(PLACEMENT_PER_CHAPTER, budget - out.length);
      k++
    ) {
      const j = k + Math.floor(random() * (order.length - k));
      [order[k], order[j]] = [order[j], order[k]];
      const question = placementQuestionFor(
        askable[order[k]],
        chapter.id,
        pools,
        random,
      );
      if (question) picks.push({ index: order[k], question });
    }
    picks.sort((a, b) => a.index - b.index);
    out.push(...picks.map((p) => p.question));
  }
  return out;
}

/**
 * The first-miss rule (I.4.f): start at the chapter of the first missed
 * question; every chapter before it is skipped. With no miss, start after the
 * last chapter the quiz reached. `chapterIds` is the current course order.
 */
export function placementOutcome(
  chapterIds: string[],
  questions: Array<{ chapterId: string }>,
  answers: Array<{ correct: boolean }>,
): { startChapterId: string | null; skippedChapterIds: string[] } {
  const first = chapterIds[0] ?? null;
  const miss = answers.findIndex((a) => !a.correct);
  if (miss !== -1) {
    const idx = chapterIds.indexOf(questions[miss].chapterId);
    // The missed chapter no longer exists: place conservatively.
    if (idx === -1) return { startChapterId: first, skippedChapterIds: [] };
    return {
      startChapterId: chapterIds[idx],
      skippedChapterIds: chapterIds.slice(0, idx),
    };
  }
  const last = questions[answers.length - 1];
  const idx = last ? chapterIds.indexOf(last.chapterId) : -1;
  if (idx === -1) return { startChapterId: first, skippedChapterIds: [] };
  return {
    startChapterId: chapterIds[idx + 1] ?? null,
    skippedChapterIds: chapterIds.slice(0, idx + 1),
  };
}
