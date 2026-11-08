import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { buildGrammarItem, slugify } from './grammar';
import {
  buildVocabItem,
  firstSenseMeaning,
  type JmdictFile,
  type JmdictWord,
} from './vocab';

/**
 * Words and grammar the beta needs but the Tanos lists don't name (E.1.b,
 * E.1.c). They carry no JLPT level, and this path only ever inserts rows and
 * fills empty meanings, so it can't change anything already stored.
 */
export type VocabSupplementEntry = {
  jmdict_id: string;
  display: string;
  reading: string;
  /** A set phrase: stored in kana, with the whole first sense as its meaning. */
  multi_word?: boolean;
  /** Set by the PM when JMdict's first sense makes a poor exemplar. */
  meaning?: string;
};

export type GrammarSupplement = {
  new: Array<{ pattern: string }>;
  /** Item id to learner-facing meaning. New patterns and existing rows. */
  meanings: Record<string, string>;
};

const DEFAULT_DATA_DIR = path.resolve(__dirname, '../../data/curriculum');

export function loadVocabSupplement(
  dataDir: string = DEFAULT_DATA_DIR,
): VocabSupplementEntry[] {
  return JSON.parse(
    fs.readFileSync(path.join(dataDir, 'vocab-supplement.json'), 'utf-8'),
  ) as VocabSupplementEntry[];
}

export function loadGrammarSupplement(
  dataDir: string = DEFAULT_DATA_DIR,
): GrammarSupplement {
  return JSON.parse(
    fs.readFileSync(path.join(dataDir, 'grammar-supplement.json'), 'utf-8'),
  ) as GrammarSupplement;
}

export function buildVocabSupplementRows(
  entries: VocabSupplementEntry[],
  words: JmdictWord[],
) {
  const byId = new Map(words.map((w) => [w.id, w]));
  return entries.map((entry) => {
    const { jmdict_id: jmdictId, display, reading } = entry;
    const word = byId.get(jmdictId);
    if (!word) throw new Error(`JMdict has no entry ${jmdictId} (${display})`);
    const forms = [...word.kanji, ...word.kana].map((f) => f.text);
    if (
      !forms.includes(display) ||
      !word.kana.some((k) => k.text === reading)
    ) {
      throw new Error(
        `JMdict entry ${jmdictId} has no form ${display} read ${reading}`,
      );
    }
    const item = buildVocabItem(
      { word, level: null, display, reading },
      `ja:vocab:${display}`,
    );
    if (!entry.multi_word) {
      return { ...item, meaning: entry.meaning ?? item.meaning };
    }
    return {
      ...item,
      meaning:
        entry.meaning ??
        firstSenseMeaning(word, display, reading) ??
        item.meaning,
      data: { ...item.data, multi_word: true },
    };
  });
}

export function buildGrammarSupplementRows(supplement: GrammarSupplement) {
  return supplement.new.map(({ pattern }) => {
    const id = `ja:grammar:${slugify(pattern)}`;
    const meaning = supplement.meanings[id];
    if (!meaning) throw new Error(`No meaning for new grammar row ${id}`);
    const item = buildGrammarItem({ pattern, description: meaning });
    return { ...item, data: { ...item.data, jlpt_level: null } };
  });
}

export async function ingestSupplement(
  prisma: PrismaClient,
  sourcePath: string,
  dataDir: string = DEFAULT_DATA_DIR,
): Promise<void> {
  const file = JSON.parse(
    fs.readFileSync(sourcePath, 'utf-8'),
  ) as unknown as JmdictFile;
  if (!Array.isArray(file.words)) {
    throw new Error(
      'Invalid supplement source: expected { words: [...] } (jmdict-simplified format).',
    );
  }
  const supplement = loadGrammarSupplement(dataDir);
  const rows = [
    ...buildVocabSupplementRows(loadVocabSupplement(dataDir), file.words),
    ...buildGrammarSupplementRows(supplement),
  ];

  const { count: inserted } = await prisma.item.createMany({
    data: rows,
    skipDuplicates: true,
  });

  const ids = Object.keys(supplement.meanings);
  const present = await prisma.item.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const known = new Set(present.map((r) => r.id));
  const missing = ids.filter((id) => !known.has(id));
  if (missing.length > 0) {
    throw new Error(
      `No item row for ${missing.length} grammar meaning(s): ${missing.join(', ')}`,
    );
  }

  let filled = 0;
  for (const id of ids) {
    const { count } = await prisma.item.updateMany({
      where: { id, meaning: null },
      data: { meaning: supplement.meanings[id] },
    });
    filled += count;
  }

  console.log(
    `ingest:items supplement — inserted ${inserted} of ${rows.length} rows, filled ${filled} empty grammar meaning(s)`,
  );
}
