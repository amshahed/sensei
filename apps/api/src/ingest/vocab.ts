import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// jmdict-simplified JSON entry (relevant fields only).
// Full spec: https://github.com/scriptin/jmdict-simplified
export type JmdictKanji = { text: string; tags: string[]; common: boolean };
export type JmdictKana = {
  text: string;
  tags: string[];
  common: boolean;
  appliesToKanji: string[];
};
// `lang` is ISO 639-2 in jmdict-simplified ("eng"), not ISO 639-1 ("en").
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

// JMdict carries no JLPT data at all, so level membership comes from the Tanos
// lists (decisions.md §E — "authoritative taxonomy of what to teach per level"),
// committed under apps/api/data/jlpt. JMdict supplies readings, senses and ids.
export type JlptLevel = 'N5' | 'N4';
export type JlptListRow = {
  expression: string;
  reading: string;
  level: JlptLevel;
};
export type JlptListSource = { level: JlptLevel; file: string };

const DATA_DIR = path.resolve(__dirname, '../../data/jlpt');
// Order matters: a word on both lists keeps the first (easier) level.
export const DEFAULT_JLPT_LISTS: JlptListSource[] = [
  { level: 'N5', file: path.join(DATA_DIR, 'n5-vocab.csv') },
  { level: 'N4', file: path.join(DATA_DIR, 'n4-vocab.csv') },
];

/** Minimal RFC-4180 line parser: commas inside "quoted" fields, "" escapes. */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      cells.push(cell);
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells;
}

/** Parse an `expression,reading` list (header row required). */
export function parseJlptList(raw: string, level: JlptLevel): JlptListRow[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const header = parseCsvLine(lines[0] ?? '').map((h) => h.trim());
  const exprIdx = header.indexOf('expression');
  const readIdx = header.indexOf('reading');
  if (exprIdx === -1 || readIdx === -1) {
    throw new Error(
      `JLPT list is missing an "expression,reading" header (got: ${lines[0] ?? '<empty>'})`,
    );
  }
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const expression = (cells[exprIdx] ?? '').trim();
    const reading = (cells[readIdx] ?? '').trim();
    // A few upstream rows leave the reading blank for kana-only words
    // (ごらんになる, かまう) — there the spelling *is* the reading.
    return {
      expression,
      reading: reading || (KANA_ONLY.test(expression) ? expression : ''),
      level,
    };
  });
}

const KANA_ONLY = /^[\u3040-\u30ffー]+$/;

const AFFIX_MARK = /[〜～~]/g;

/**
 * Expand one list cell into the spellings JMdict may file it under:
 *  - "足; 脚", "回る、回す" → 足, 脚 / 回る, 回す (alternatives)
 *  - "～円"           → 円                (counter / affix marker)
 *  - "パート (タイム)" → パートタイム, パート (optional part)
 */
export function cellVariants(cell: string): string[] {
  const out = new Set<string>();
  for (const part of cell.split(/[;；、]/)) {
    const base = part.replace(AFFIX_MARK, '').trim();
    if (!base) continue;
    const keepOptional = base.replace(/[()（）]/g, '').replace(/\s+/g, '');
    const dropOptional = base
      .replace(/[(（][^)）]*[)）]/g, '')
      .replace(/\s+/g, '');
    if (keepOptional) out.add(keepOptional);
    if (dropOptional) out.add(dropOptional);
  }
  return [...out];
}

/**
 * cellVariants + the bare noun for suru-verbs: the list writes うんどうする /
 * コピーする, but JMdict files the noun (運動 / コピー) tagged `vs`.
 */
export function readingVariants(cell: string): string[] {
  const out = new Set<string>();
  for (const v of cellVariants(cell)) {
    out.add(v);
    if (v.length > 2 && v.endsWith('する')) out.add(v.slice(0, -2));
  }
  return [...out];
}

export type JlptMatch = {
  word: JmdictWord;
  level: JlptLevel;
  /** The spelling the list uses (e.g. これ, not the rare kanji 此れ). */
  display: string;
  reading: string;
};

/**
 * Join list rows to JMdict entries on (spelling, reading). Ambiguous rows prefer
 * a `common` entry, then JMdict file order. A word reached by several rows (or
 * on both lists) is kept once, at its first row's level.
 */
export function matchJlptList(
  words: JmdictWord[],
  rows: JlptListRow[],
): { matches: JlptMatch[]; unmatched: JlptListRow[] } {
  const byText = new Map<string, JmdictWord[]>();
  for (const w of words) {
    const texts = new Set([
      ...w.kanji.map((k) => k.text),
      ...w.kana.map((k) => k.text),
    ]);
    for (const t of texts) {
      const bucket = byText.get(t);
      if (bucket) bucket.push(w);
      else byText.set(t, [w]);
    }
  }

  const isCommon = (w: JmdictWord) =>
    w.kanji.some((k) => k.common) || w.kana.some((k) => k.common);

  const matches: JlptMatch[] = [];
  const unmatched: JlptListRow[] = [];
  const seen = new Set<string>();

  const findCandidates = (expression: string, readingCell: string) => {
    const readings = readingVariants(readingCell);
    const found: { word: JmdictWord; form: string; reading: string }[] = [];
    for (const form of readingVariants(expression)) {
      for (const word of byText.get(form) ?? []) {
        const reading = readings.find((r) =>
          word.kana.some((k) => k.text === r),
        );
        if (reading) found.push({ word, form, reading });
      }
    }
    return found;
  };

  for (const row of rows) {
    let candidates = findCandidates(row.expression, row.reading);
    // A few upstream rows have the columns swapped (いただく / 頂く).
    if (candidates.length === 0) {
      candidates = findCandidates(row.reading, row.expression);
    }
    if (candidates.length === 0) {
      unmatched.push(row);
      continue;
    }
    const pick = candidates.find((c) => isCommon(c.word)) ?? candidates[0];
    if (seen.has(pick.word.id)) continue;
    seen.add(pick.word.id);
    matches.push({
      word: pick.word,
      level: row.level,
      display: pick.form,
      reading: pick.reading,
    });
  }

  return { matches, unmatched };
}

const isEnglish = (g: JmdictGloss) => g.lang === 'eng' || g.lang === 'en';

export function buildVocabItem(match: JlptMatch, id: string) {
  const { word } = match;
  const enGlosses = word.sense
    .flatMap((s) => s.gloss.filter(isEnglish).map((g) => g.text))
    .slice(0, 3);

  return {
    id,
    language: 'ja',
    type: 'VOCAB' as const,
    display: match.display,
    reading: match.reading,
    meaning: enGlosses[0] ?? null,
    data: {
      writing_forms: word.kanji.map((k) => k.text),
      readings: word.kana.map((k) => k.text),
      senses: enGlosses,
      jmdict_id: word.id,
      jlpt: match.level,
    },
  };
}

/**
 * Item ids are `ja:vocab:<display>`; when two distinct JMdict words share a
 * display form (方 = かた "person" / ほう "direction"), the later one gets the
 * reading appended (`ja:vocab:方:ほう`) instead of being dropped.
 */
export function assignVocabIds(matches: JlptMatch[]): {
  assigned: { match: JlptMatch; id: string }[];
  dropped: JlptMatch[];
} {
  const used = new Set<string>();
  const assigned: { match: JlptMatch; id: string }[] = [];
  const dropped: JlptMatch[] = [];
  for (const match of matches) {
    let id = `ja:vocab:${match.display}`;
    if (used.has(id)) id = `${id}:${match.reading}`;
    if (used.has(id)) {
      // Two JMdict entries with identical spelling AND reading — keep the first.
      dropped.push(match);
      continue;
    }
    used.add(id);
    assigned.push({ match, id });
  }
  return { assigned, dropped };
}

export async function ingestVocab(
  prisma: PrismaClient,
  sourcePath: string,
  lists: JlptListSource[] = DEFAULT_JLPT_LISTS,
): Promise<void> {
  const raw = fs.readFileSync(sourcePath, 'utf-8');
  const file = JSON.parse(raw) as unknown as JmdictFile;
  if (!Array.isArray(file.words)) {
    throw new Error(
      `Invalid vocab source file: expected { words: [...] } (jmdict-simplified format) but got a different shape. Check that you are using the correct file for this command.`,
    );
  }

  const rows = lists.flatMap(({ level, file: listPath }) =>
    parseJlptList(fs.readFileSync(listPath, 'utf-8'), level),
  );
  const { matches, unmatched } = matchJlptList(file.words, rows);
  const { assigned, dropped } = assignVocabIds(matches);
  const items = assigned.map(({ match, id }) => buildVocabItem(match, id));

  if (dropped.length) {
    console.warn(
      `ingest:items vocab — ${dropped.length} same-spelling-and-reading duplicate(s) skipped:\n  ${dropped
        .map((m) => `${m.display} / ${m.reading} (jmdict_id=${m.word.id})`)
        .join('\n  ')}`,
    );
  }
  if (unmatched.length) {
    console.warn(
      `ingest:items vocab — ${unmatched.length} list row(s) had no JMdict match (skipped):\n  ${unmatched
        .map((r) => `${r.level} ${r.expression} / ${r.reading}`)
        .join('\n  ')}`,
    );
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

  const byLevel = (l: JlptLevel) =>
    items.filter((i) => i.data.jlpt === l).length;
  console.log(
    `ingest:items vocab — upserted ${items.length} vocab items (N5 ${byLevel('N5')}, N4 ${byLevel('N4')}) from ${rows.length} list rows; ${unmatched.length} unmatched`,
  );
}
