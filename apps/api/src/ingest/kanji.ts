import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import { isDeepStrictEqual } from 'util';
import {
  EMPTY_KANJI_SUPPLEMENT,
  type KanjiSupplement,
  loadKanjiSupplement,
} from './supplement';

// kanjidic2-simplified JSON character (relevant fields only).
// Full spec: https://github.com/scriptin/jmdict-simplified (kanjidic2 bundle)
export type Kd2Reading = { type: string; value: string };
export type Kd2Meaning = { lang: string; value: string };
export type Kd2Group = { readings: Kd2Reading[]; meanings: Kd2Meaning[] };
export type Kd2Misc = {
  strokeCounts: number[];
  // KANJIDIC2 carries the *pre-2010* JLPT level: 1–4, where 4 is the easiest.
  // There is no 5. Map to modern levels with toModernJlpt().
  jlptLevel?: number | null;
  grade?: number;
  frequency?: number;
};
export type Kd2Character = {
  literal: string;
  misc: Kd2Misc;
  readingMeaning?: { groups: Kd2Group[] };
};
export type Kd2File = { characters: Kd2Character[] };

/**
 * Old JLPT (1–4) → modern (N1–N5). The 2010 reform inserted N3 between old 2
 * and old 3, so only the easy end maps cleanly: old 4 ≈ N5 (~100 kanji), old 3 ≈ N4.
 * Harder levels have no clean equivalent and are not ingested.
 */
export function toModernJlpt(
  old: number | null | undefined,
): 'N5' | 'N4' | undefined {
  if (old === 4) return 'N5';
  if (old === 3) return 'N4';
  return undefined;
}

export function isN5Kanji(char: Kd2Character): boolean {
  return toModernJlpt(char.misc.jlptLevel) === 'N5';
}

/**
 * The Item row for a KANJIDIC2 character. `supplement` (G.4.g) can pick which
 * of its English senses is the meaning shown, and name the kun reading of the
 * verb its lesson teaches (`data.word_reading`, G.4.f). Both must come from
 * the character's own KANJIDIC2 data, or this throws: the supplement chooses
 * among canonical values and never invents one.
 */
export function buildKanjiItem(
  char: Kd2Character,
  supplement: KanjiSupplement = EMPTY_KANJI_SUPPLEMENT,
) {
  const groups = char.readingMeaning?.groups ?? [];

  const onReadings = groups.flatMap((g) =>
    g.readings.filter((r) => r.type === 'ja_on').map((r) => r.value),
  );

  const kunReadings = groups.flatMap((g) =>
    g.readings.filter((r) => r.type === 'ja_kun').map((r) => r.value),
  );

  const meanings = groups.flatMap((g) =>
    g.meanings.filter((m) => m.lang === 'en').map((m) => m.value),
  );

  const primaryReading = kunReadings[0] ?? onReadings[0] ?? null;
  const strokeCount = char.misc.strokeCounts[0] ?? 0;

  const taughtMeaning = supplement.meanings[char.literal];
  if (taughtMeaning !== undefined && !meanings.includes(taughtMeaning)) {
    throw new Error(
      `kanji-supplement: "${taughtMeaning}" isn't a KANJIDIC2 sense of ${char.literal} (${meanings.join('; ')})`,
    );
  }
  const primaryMeaning = taughtMeaning ?? meanings[0] ?? null;

  const wordReading = supplement.words[char.literal];
  if (
    wordReading !== undefined &&
    (!kunReadings.includes(wordReading) || !wordReading.includes('.'))
  ) {
    throw new Error(
      `kanji-supplement: "${wordReading}" isn't a KANJIDIC2 kun reading of ${char.literal} with okurigana (${kunReadings.join(', ')})`,
    );
  }

  return {
    id: `ja:kanji:${char.literal}`,
    language: 'ja',
    type: 'KANJI' as const,
    display: char.literal,
    reading: primaryReading,
    meaning: primaryMeaning,
    data: {
      meanings,
      on_readings: onReadings,
      kun_readings: kunReadings,
      stroke_count: strokeCount,
      jlpt: toModernJlpt(char.misc.jlptLevel) ?? null,
      ...(wordReading !== undefined ? { word_reading: wordReading } : {}),
    },
  };
}

export type KanjiItem = ReturnType<typeof buildKanjiItem>;

/** The stored fields a kanji ingest writes, as the dry run compares them. */
type StoredKanji = {
  id: string;
  display: string;
  reading: string | null;
  meaning: string | null;
  data: unknown;
};

/**
 * What an upsert of `items` would change, one line per changed field: the
 * top-level columns, and `data` key by key. A row not stored yet is one line.
 */
export function diffKanjiRows(
  items: KanjiItem[],
  stored: StoredKanji[],
): string[] {
  const byId = new Map(stored.map((row) => [row.id, row]));
  const show = (v: unknown) =>
    v === undefined ? '(absent)' : JSON.stringify(v);
  const lines: string[] = [];
  for (const item of items) {
    const row = byId.get(item.id);
    if (!row) {
      lines.push(`${item.id}  new row`);
      continue;
    }
    for (const field of ['display', 'reading', 'meaning'] as const) {
      if (row[field] !== item[field]) {
        lines.push(
          `${item.id}  ${field}: ${show(row[field])} → ${show(item[field])}`,
        );
      }
    }
    const before = (row.data ?? {}) as Record<string, unknown>;
    const after = item.data as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    for (const key of keys) {
      if (!isDeepStrictEqual(before[key], after[key])) {
        lines.push(
          `${item.id}  data.${key}: ${show(before[key])} → ${show(after[key])}`,
        );
      }
    }
  }
  return lines;
}

/**
 * Upserts every N5 kanji from a KANJIDIC2 file, with the committed supplement
 * applied (G.4.g). `dryRun` prints what would change, field by field, and
 * writes nothing: how a live apply is checked before it runs.
 */
export async function ingestKanji(
  prisma: PrismaClient,
  sourcePath: string,
  {
    dryRun = false,
    supplement = loadKanjiSupplement(),
  }: { dryRun?: boolean; supplement?: KanjiSupplement } = {},
): Promise<void> {
  const raw = fs.readFileSync(sourcePath, 'utf-8');
  const file = JSON.parse(raw) as unknown as Kd2File;
  if (!Array.isArray(file.characters)) {
    throw new Error(
      `Invalid kanji source file: expected { characters: [...] } (kanjidic2-simplified format) but got a different shape. Check that you are using the correct file for this command.`,
    );
  }

  const filtered = file.characters.filter(isN5Kanji);
  const n5 = new Set(filtered.map((c) => c.literal));
  const unknown = [
    ...Object.keys(supplement.meanings),
    ...Object.keys(supplement.words),
  ].filter((literal) => !n5.has(literal));
  if (unknown.length > 0) {
    throw new Error(
      `kanji-supplement names ${unknown.length} character(s) that aren't N5 kanji in this file: ${[...new Set(unknown)].join(' ')}`,
    );
  }
  const items = filtered.map((char) => buildKanjiItem(char, supplement));

  if (dryRun) {
    const stored = await prisma.item.findMany({
      where: { id: { in: items.map((item) => item.id) } },
      select: {
        id: true,
        display: true,
        reading: true,
        meaning: true,
        data: true,
      },
    });
    const lines = diffKanjiRows(items, stored);
    const rows = new Set(lines.map((line) => line.split('  ')[0]));
    for (const line of lines) console.log(line);
    console.log(
      `ingest:items kanji --dry-run — ${rows.size} of ${items.length} N5 kanji rows would change; nothing written`,
    );
    return;
  }

  for (const item of items) {
    await prisma.item.upsert({
      where: { id: item.id },
      update: {
        display: item.display,
        reading: item.reading,
        meaning: item.meaning,
        data: item.data,
      },
      create: item,
    });
  }

  console.log(
    `ingest:items kanji — upserted ${items.length} N5 kanji from ${file.characters.length} total characters`,
  );
}
