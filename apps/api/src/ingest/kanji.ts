import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

// kanjidic2-simplified JSON character (relevant fields only).
// Full spec: https://github.com/scriptin/jmdict-simplified (kanjidic2 bundle)
export type Kd2Reading = { type: string; value: string };
export type Kd2Meaning = { lang: string; value: string };
export type Kd2Group = { readings: Kd2Reading[]; meanings: Kd2Meaning[] };
export type Kd2Misc = {
  strokeCounts: number[];
  jlptLevel?: number; // 1–5, where 5 = N5
  grade?: number;
  frequency?: number;
};
export type Kd2Character = {
  literal: string;
  misc: Kd2Misc;
  readingMeaning?: { groups: Kd2Group[] };
};
export type Kd2File = { characters: Kd2Character[] };

export function isN5Kanji(char: Kd2Character): boolean {
  return char.misc.jlptLevel === 5;
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
      jlpt: 'N5',
    },
  };
}

export async function ingestKanji(
  prisma: PrismaClient,
  sourcePath: string,
): Promise<void> {
  const raw = fs.readFileSync(sourcePath, 'utf-8');
  const file = JSON.parse(raw) as unknown as Kd2File;

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
