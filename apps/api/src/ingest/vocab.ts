import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { isKanaOnly } from '../common/japanese-script';

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
  /** Kanji / kana forms this sense is restricted to; ["*"] = all. */
  appliesToKanji?: string[];
  appliesToKana?: string[];
  /** e.g. "uk" = usually written using kana alone. */
  misc?: string[];
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
// The list's `meaning` column is used ONLY to choose between JMdict homophones
// (そば "beside" vs 蕎麦 "noodles"); it is never stored or shown.
export type JlptLevel = 'N5' | 'N4';
export type JlptListRow = {
  expression: string;
  reading: string;
  meaning?: string;
  level: JlptLevel;
};
export type JlptListSource = { level: JlptLevel; file: string };

const DATA_DIR = path.resolve(__dirname, '../../data/jlpt');
// Order matters: a word on both lists keeps the first (easier) level.
export const DEFAULT_JLPT_LISTS: JlptListSource[] = [
  { level: 'N5', file: path.join(DATA_DIR, 'n5-vocab.csv') },
  { level: 'N4', file: path.join(DATA_DIR, 'n4-vocab.csv') },
];

const AFFIX_MARK = /[〜～~]/g;
/** Kanji spellings JMdict marks rare / search-only / irregular / outdated. */
const NON_STANDARD_KANJI_TAGS = new Set(['rK', 'sK', 'iK', 'oK']);

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

/**
 * Parse an `expression,reading[,meaning]` list (header row required). A row
 * naming several words positionally (回る、回す / まわる、まわす) becomes one
 * row per word.
 */
export function parseJlptList(raw: string, level: JlptLevel): JlptListRow[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const header = parseCsvLine(lines[0] ?? '').map((h) => h.trim());
  const exprIdx = header.indexOf('expression');
  const readIdx = header.indexOf('reading');
  const meanIdx = header.indexOf('meaning');
  if (exprIdx === -1 || readIdx === -1) {
    throw new Error(
      `JLPT list is missing an "expression,reading" header (got: ${lines[0] ?? '<empty>'})`,
    );
  }
  return lines.slice(1).flatMap((line) => {
    const cells = parseCsvLine(line);
    const expression = (cells[exprIdx] ?? '').trim();
    const rawReading = (cells[readIdx] ?? '').trim();
    const meaning = meanIdx === -1 ? undefined : cells[meanIdx]?.trim();
    // A few upstream rows leave the reading blank for kana-only words
    // (ごらんになる, かまう) — there the spelling *is* the reading.
    const reading = rawReading || (isKanaOnly(expression) ? expression : '');

    const exprParts = expression.split('、');
    const readParts = reading.split('、');
    if (exprParts.length > 1 && exprParts.length === readParts.length) {
      return exprParts.map((e, i) => ({
        expression: e.trim(),
        reading: readParts[i].trim(),
        meaning,
        level,
      }));
    }
    return [{ expression, reading, meaning, level }];
  });
}

/**
 * Expand one list cell into the spellings JMdict may file it under:
 *  - "足; 脚"         → 足, 脚            (alternatives)
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

const applies = (restriction: string[] | undefined, form: string) =>
  !restriction || restriction.length === 0
    ? true
    : restriction.includes('*') || restriction.includes(form);

/** Senses that apply to this (spelling, reading) — not to another reading of the entry. */
export function applicableSenses(
  word: JmdictWord,
  display: string,
  reading: string,
): JmdictSense[] {
  const displayIsKanjiForm = word.kanji.some((k) => k.text === display);
  return word.sense.filter(
    (s) =>
      applies(s.appliesToKana, reading) &&
      (!displayIsKanjiForm || applies(s.appliesToKanji, display)),
  );
}

const isEnglish = (g: JmdictGloss) => g.lang === 'eng' || g.lang === 'en';

const STOPWORDS = new Set(
  'a an the to of and or in on at for with by be is as one some someone something abbr esp eg etc'.split(
    ' ',
  ),
);

/** Lower-cased content words, naive plural-stripped ("noodles" ≈ "noodle"). */
export function glossTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().match(/[a-z]+/g) ?? []) {
    if (raw.length < 3 || STOPWORDS.has(raw)) continue;
    out.add(raw.length > 3 && raw.endsWith('s') ? raw.slice(0, -1) : raw);
  }
  return out;
}

/**
 * The spelling to teach. Tanos sometimes lists a word under kanji that real
 * text almost never uses (居る, 有る, 下さい); when JMdict marks the word's
 * primary sense "uk" (usually written in kana alone), teach the kana — いる,
 * ある, ください — and keep the kanji in `writing_forms` for reference.
 */
export function learnerSpelling(
  word: JmdictWord,
  form: string,
  reading: string,
): string {
  if (isKanaOnly(form)) return form;
  const primary = applicableSenses(word, form, reading)[0];
  return primary?.misc?.includes('uk') ? reading : form;
}

export type JlptMatch = {
  word: JmdictWord;
  /** Null for a supplement word, which no Tanos list names (E.1.b). */
  level: JlptLevel | null;
  /** The list's spelling (これ, not the rare 此れ) — or its kana if usually kana (居る → いる). */
  display: string;
  reading: string;
};

export type MatchReport = {
  matches: JlptMatch[];
  /** No JMdict entry has this (spelling, reading). */
  unmatched: JlptListRow[];
  /** Every candidate is a word an earlier row already took (e.g. on both lists). */
  duplicates: JlptListRow[];
  /** Top candidates tied on meaning — picked by `common` / file order; worth a look. */
  lowConfidence: { row: JlptListRow; picked: JlptMatch; others: string[] }[];
};

type Candidate = {
  word: JmdictWord;
  form: string;
  reading: string;
  overlap: number;
  /** overlap ÷ distinct gloss words: specific 点ける beats catch-all 付ける. */
  density: number;
  usuallyKana: boolean;
  common: boolean;
  order: number;
};

/**
 * Join list rows to JMdict entries on (spelling, reading). When several JMdict
 * words fit, rank by gloss overlap with the row's primary meaning (text before
 * the first ";") → overlap density → usually-kana for a kana spelling →
 * `common` → JMdict file order. A row whose best match was already taken by an earlier row is a
 * duplicate, unless an untaken candidate also shares its meaning.
 */
export function matchJlptList(
  words: JmdictWord[],
  rows: JlptListRow[],
): MatchReport {
  const byText = new Map<string, number[]>();
  words.forEach((w, idx) => {
    const texts = new Set([
      ...w.kanji.map((k) => k.text),
      ...w.kana.map((k) => k.text),
    ]);
    for (const t of texts) {
      const bucket = byText.get(t);
      if (bucket) bucket.push(idx);
      else byText.set(t, [idx]);
    }
  });

  const findCandidates = (
    expression: string,
    readingCell: string,
    primaryMeaning: Set<string>,
  ): Candidate[] => {
    const readings = readingVariants(readingCell);
    const found = new Map<string, Candidate>();
    for (const form of readingVariants(expression)) {
      for (const idx of byText.get(form) ?? []) {
        const word = words[idx];
        if (found.has(word.id)) continue;
        const reading = readings.find((r) =>
          word.kana.some((k) => k.text === r),
        );
        if (!reading) continue;
        const senses = applicableSenses(word, form, reading);
        const glosses = glossTokens(
          senses
            .flatMap((s) => s.gloss.filter(isEnglish).map((g) => g.text))
            .join(' '),
        );
        let overlap = 0;
        for (const t of primaryMeaning) if (glosses.has(t)) overlap++;
        found.set(word.id, {
          word,
          form,
          reading,
          overlap,
          density: glosses.size ? overlap / glosses.size : 0,
          usuallyKana:
            isKanaOnly(form) &&
            (word.kanji.length === 0 ||
              senses.some((s) => s.misc?.includes('uk'))),
          common:
            word.kanji.some((k) => k.common) || word.kana.some((k) => k.common),
          order: idx,
        });
      }
    }
    return [...found.values()];
  };

  const rank = (a: Candidate, b: Candidate) =>
    b.overlap - a.overlap ||
    b.density - a.density ||
    Number(b.usuallyKana) - Number(a.usuallyKana) ||
    Number(b.common) - Number(a.common) ||
    a.order - b.order;
  const sameStrength = (a: Candidate, b: Candidate) =>
    a.overlap === b.overlap &&
    a.density === b.density &&
    a.usuallyKana === b.usuallyKana &&
    a.common === b.common;

  const report: MatchReport = {
    matches: [],
    unmatched: [],
    duplicates: [],
    lowConfidence: [],
  };
  const taken = new Set<string>();

  for (const row of rows) {
    const primary = glossTokens((row.meaning ?? '').split(/[;；]/)[0]);
    let candidates = findCandidates(row.expression, row.reading, primary);
    // A few upstream rows have the columns swapped (いただく / 頂く).
    if (candidates.length === 0) {
      candidates = findCandidates(row.reading, row.expression, primary);
    }
    if (candidates.length === 0) {
      report.unmatched.push(row);
      continue;
    }
    candidates.sort(rank);
    // If the row's best match is a word an earlier row already took, the row
    // names that same word (掛ける, then かける "to call") — unless an untaken
    // candidate genuinely shares its meaning (キロ taken → キロメートル).
    const fresh = candidates.filter((c) => !taken.has(c.word.id));
    const usable = taken.has(candidates[0].word.id)
      ? fresh.filter((c) => c.overlap > 0)
      : fresh;
    if (usable.length === 0) {
      report.duplicates.push(row);
      continue;
    }
    const [best, next] = usable;
    taken.add(best.word.id);
    const picked: JlptMatch = {
      word: best.word,
      level: row.level,
      display: learnerSpelling(best.word, best.form, best.reading),
      reading: best.reading,
    };
    report.matches.push(picked);
    if (next && sameStrength(best, next)) {
      report.lowConfidence.push({
        row,
        picked,
        others: usable
          .slice(1)
          .filter((c) => sameStrength(best, c))
          .map((c) => `${c.form}/${c.reading} (jmdict_id=${c.word.id})`),
      });
    }
  }

  return report;
}

/**
 * Kanji spellings of the word that the matched reading actually uses, minus
 * forms JMdict marks rare / search-only / irregular / outdated (これ keeps none
 * of 此れ, 是, 之…).
 */
export function standardWritingForms(
  word: JmdictWord,
  reading: string,
): string[] {
  const kana = word.kana.find((k) => k.text === reading);
  // On a kana form, ["*"] = every kanji spelling, [] = none (e.g. ネコ).
  const usesKanji = (text: string) =>
    !kana ||
    kana.appliesToKanji.includes('*') ||
    kana.appliesToKanji.includes(text);
  return word.kanji
    .filter((k) => !k.tags.some((t) => NON_STANDARD_KANJI_TAGS.has(t)))
    .filter((k) => usesKanji(k.text))
    .map((k) => k.text);
}

/** All English glosses of the word's first applicable sense, joined. */
export function firstSenseMeaning(
  word: JmdictWord,
  display: string,
  reading: string,
): string | null {
  const [first] = applicableSenses(word, display, reading);
  const glosses = first?.gloss.filter(isEnglish).map((g) => g.text) ?? [];
  return glosses.length > 0 ? glosses.join('; ') : null;
}

export function buildVocabItem(match: JlptMatch, id: string) {
  const { word, display, reading } = match;
  const enGlosses = applicableSenses(word, display, reading)
    .flatMap((s) => s.gloss.filter(isEnglish).map((g) => g.text))
    .slice(0, 3);

  return {
    id,
    language: 'ja',
    type: 'VOCAB' as const,
    display,
    reading,
    meaning: enGlosses[0] ?? null,
    data: {
      writing_forms: standardWritingForms(word, reading),
      readings: word.kana.map((k) => k.text),
      senses: enGlosses,
      jmdict_id: word.id,
      jlpt: match.level,
    },
  };
}

/**
 * Item ids. Once a JMdict word has an id it keeps it forever (`existing`, read
 * from the DB), so re-ingesting after a list edit or a new JMdict release can
 * never rename a word's id (orphaning its mastery) or re-point an id at a
 * different word (silently corrupting every learner's FSRS state for it).
 *
 * A word new to the DB gets `ja:vocab:<display>` if that spelling is unique in
 * the current set and unused; otherwise it is qualified — by reading
 * (`ja:vocab:方:ほう`), or by JMdict id when spelling and reading coincide (kana
 * homophones, `ja:vocab:そう:1006610`) or the reading-qualified id is taken.
 * Given the same DB state and lists, the result is independent of list order.
 */
export function assignVocabIds(
  matches: JlptMatch[],
  existing: ReadonlyMap<string, string> = new Map(),
): { match: JlptMatch; id: string }[] {
  const stickyByJmdict = new Map<string, string>();
  for (const [id, jmdictId] of [...existing].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (!stickyByJmdict.has(jmdictId)) stickyByJmdict.set(jmdictId, id);
  }
  const taken = new Set(existing.keys());

  const count = (key: (m: JlptMatch) => string) => {
    const n = new Map<string, number>();
    for (const m of matches) n.set(key(m), (n.get(key(m)) ?? 0) + 1);
    return n;
  };
  const byDisplay = count((m) => m.display);
  const byDisplayReading = count((m) => `${m.display}:${m.reading}`);

  // Sticky ids first, so a new word can never claim one this run.
  const sticky = new Map<JlptMatch, string>();
  for (const m of matches) {
    const id = stickyByJmdict.get(m.word.id);
    if (id) sticky.set(m, id);
  }

  return matches.map((match) => {
    const kept = sticky.get(match);
    if (kept) return { match, id: kept };

    const { display, reading, word } = match;
    const bare = `ja:vocab:${display}`;
    const byReading = `${bare}:${reading}`;
    const byJmdict = `${bare}:${word.id}`;
    const kanaHomophone = display === reading;
    let id: string;
    if ((byDisplay.get(display) ?? 0) === 1 && !taken.has(bare)) id = bare;
    else if (
      !kanaHomophone &&
      (byDisplayReading.get(`${display}:${reading}`) ?? 0) === 1 &&
      !taken.has(byReading)
    )
      id = byReading;
    else id = byJmdict;
    taken.add(id);
    return { match, id };
  });
}

const fmtRow = (r: JlptListRow) => `${r.level} ${r.expression} / ${r.reading}`;

const jmdictIdOf = (data: unknown): string | undefined =>
  (data as { jmdict_id?: string } | null)?.jmdict_id;
const levelOf = (data: unknown): string | null =>
  (data as { jlpt?: string | null } | null)?.jlpt ?? null;

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
  const report = matchJlptList(file.words, rows);

  const stored = await prisma.item.findMany({
    where: { language: 'ja', type: 'VOCAB' },
    select: { id: true, data: true },
  });
  const existing = new Map(
    stored.map((r) => [r.id, String(jmdictIdOf(r.data) ?? `?${r.id}`)]),
  );
  const items = assignVocabIds(report.matches, existing).map(({ match, id }) =>
    buildVocabItem(match, id),
  );
  const itemByJmdict = new Map(items.map((i) => [i.data.jmdict_id, i]));

  if (report.unmatched.length) {
    console.warn(
      `ingest:items vocab — ${report.unmatched.length} list row(s) had no JMdict match (skipped):\n  ${report.unmatched.map(fmtRow).join('\n  ')}`,
    );
  }
  if (report.duplicates.length) {
    console.warn(
      `ingest:items vocab — ${report.duplicates.length} list row(s) name a word an earlier row already took (skipped):\n  ${report.duplicates.map(fmtRow).join('\n  ')}`,
    );
  }
  if (report.lowConfidence.length) {
    console.warn(
      `ingest:items vocab — ${report.lowConfidence.length} row(s) matched several JMdict words equally well; picked by common/file order — worth a look:\n  ${report.lowConfidence
        .map(
          ({ row, picked }) =>
            `${fmtRow(row)} → ${picked.display}/${picked.reading} (jmdict_id=${picked.word.id}) "${itemByJmdict.get(picked.word.id)?.meaning ?? ''}"`,
        )
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

  // Words that dropped off the lists keep their row (lessons / mastery may
  // reference them) but lose their level, so level-filtered authoring stops
  // offering them.
  const current = new Set(items.map((i) => i.id));
  const retired = stored.filter(
    (r) => !current.has(r.id) && levelOf(r.data) !== null,
  );
  for (const r of retired) {
    await prisma.item.update({
      where: { id: r.id },
      data: { data: { ...(r.data as object), jlpt: null } },
    });
  }
  if (retired.length) {
    console.warn(
      `ingest:items vocab — ${retired.length} stored word(s) are no longer on the lists; kept, but their jlpt level was cleared:\n  ${retired.map((r) => r.id).join('\n  ')}`,
    );
  }

  const byLevel = (l: JlptLevel) =>
    items.filter((i) => i.data.jlpt === l).length;
  console.log(
    `ingest:items vocab — upserted ${items.length} vocab items (N5 ${byLevel('N5')}, N4 ${byLevel('N4')}) from ${rows.length} list rows; ${report.unmatched.length} unmatched, ${report.duplicates.length} duplicate, ${report.lowConfidence.length} low-confidence`,
  );
}
