import { PrismaClient } from '@prisma/client';
import { ALL_KANA, KanaEntry } from './kana-data';

export function buildKanaItem(entry: KanaEntry) {
  return {
    id: entry.id,
    language: 'ja',
    type: 'KANA' as const,
    display: entry.display,
    reading: entry.display,
    meaning: null,
    data: { romaji: entry.romaji, script: entry.script },
  };
}

export async function ingestKana(prisma: PrismaClient): Promise<void> {
  const items = ALL_KANA.map(buildKanaItem);

  await prisma.$transaction(
    items.map((item) =>
      prisma.item.upsert({
        where: { id: item.id },
        update: {
          display: item.display,
          reading: item.reading,
          meaning: item.meaning,
          data: item.data,
        },
        create: item,
      }),
    ),
  );

  console.log(
    `ingest:items kana — upserted ${items.length} kana (${items.length / 2} hiragana + ${items.length / 2} katakana)`,
  );
}
