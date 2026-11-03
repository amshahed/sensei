import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

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

export function buildKanjiItem(char: Kd2Character) {
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
  const primaryMeaning = meanings[0] ?? null;
  const strokeCount = char.misc.strokeCounts[0] ?? 0;

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
    },
  };
}

export async function ingestKanji(
  prisma: PrismaClient,
  sourcePath: string,
): Promise<void> {
  const raw = fs.readFileSync(sourcePath, 'utf-8');
  const file = JSON.parse(raw) as unknown as Kd2File;
  if (!Array.isArray(file.characters)) {
    throw new Error(
      `Invalid kanji source file: expected { characters: [...] } (kanjidic2-simplified format) but got a different shape. Check that you are using the correct file for this command.`,
    );
  }

  const filtered = file.characters.filter(isN5Kanji);
  const items = filtered.map(buildKanjiItem);

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
