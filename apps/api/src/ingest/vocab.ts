import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

// jmdict-simplified JSON entry (relevant fields only).
// Full spec: https://github.com/scriptin/jmdict-simplified
export type JmdictKanji = { text: string; tags: string[]; common: boolean };
export type JmdictKana = {
  text: string;
  tags: string[];
  common: boolean;
  appliesToKanji: string[];
};
export type JmdictGloss = { lang: string; text: string };
export type JmdictSense = {
  gloss: JmdictGloss[];
  partOfSpeech?: string[];
};
export type JmdictWord = {
  id: string;
  kanji: JmdictKanji[];
  kana: JmdictKana[];
  sense: JmdictSense[];
};
export type JmdictFile = { words: JmdictWord[] };

const TARGET_JLPT_TAGS = new Set(['jlpt-n5', 'jlpt-n4']);

export function isTargetJlpt(word: JmdictWord): boolean {
  const allTags = [
    ...word.kanji.flatMap((k) => k.tags),
    ...word.kana.flatMap((k) => k.tags),
  ];
  return allTags.some((t) => TARGET_JLPT_TAGS.has(t));
}

export function getJlptLevel(word: JmdictWord): string | undefined {
  const allTags = [
    ...word.kanji.flatMap((k) => k.tags),
    ...word.kana.flatMap((k) => k.tags),
  ];
  if (allTags.includes('jlpt-n5')) return 'N5';
  if (allTags.includes('jlpt-n4')) return 'N4';
  return undefined;
}

export function buildVocabItem(word: JmdictWord) {
  const primaryDisplay =
    word.kanji.find((k) => k.common)?.text ??
    word.kanji[0]?.text ??
    word.kana[0]?.text ??
    '';

  const primaryReading =
    word.kana.find((k) => k.common)?.text ?? word.kana[0]?.text ?? null;

  const enGlosses = word.sense
    .flatMap((s) => s.gloss.filter((g) => g.lang === 'en').map((g) => g.text))
    .slice(0, 3);

  const primaryMeaning = enGlosses[0] ?? null;

  const writingForms = word.kanji.map((k) => k.text);
  const readings = word.kana.map((k) => k.text);
  const jlpt = getJlptLevel(word);

  return {
    id: `ja:vocab:${primaryDisplay}`,
    language: 'ja',
    type: 'VOCAB' as const,
    display: primaryDisplay,
    reading: primaryReading,
    meaning: primaryMeaning,
    data: {
      writing_forms: writingForms,
      readings,
      senses: enGlosses,
      jmdict_id: word.id,
      ...(jlpt ? { jlpt } : {}),
    },
  };
}

export async function ingestVocab(
  prisma: PrismaClient,
  sourcePath: string,
): Promise<void> {
  const raw = fs.readFileSync(sourcePath, 'utf-8');
  const file = JSON.parse(raw) as unknown as JmdictFile;
  if (!Array.isArray(file.words)) {
    throw new Error(
      `Invalid vocab source file: expected { words: [...] } (jmdict-simplified format) but got a different shape. Check that you are using the correct file for this command.`,
    );
  }

  const filtered = file.words.filter(isTargetJlpt);
  const items = filtered.map(buildVocabItem);

  // Deduplicate by id — homographs (different JMdict entries with the same primary kanji form) collapse here.
  const seen = new Set<string>();
  const dropped: string[] = [];
  const unique = items.filter((item, idx) => {
    if (seen.has(item.id)) {
      dropped.push(`${item.id} (jmdict_id=${filtered[idx].id})`);
      return false;
    }
    seen.add(item.id);
    return true;
  });
  if (dropped.length) {
    console.warn(
      `ingest:items vocab — ${dropped.length} homograph(s) skipped:\n  ${dropped.join('\n  ')}`,
    );
  }

  for (const item of unique) {
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
    `ingest:items vocab — upserted ${unique.length} vocab items (${filtered.length - unique.length} dupes skipped) from ${file.words.length} total entries`,
  );
}
