import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import { VoyageClient } from '../../voyage/voyage-client';
import {
  buildTokenizer,
  type JapaneseTokenizer,
} from '../../common/japanese-tokenizer';
import { hasKanji } from '../../common/japanese-script';
import { upsertRefDocs } from './upsert-doc';

// Tatoeba sentences.csv / jpn_sentences.tsv format: id\tlang\ttext
// (or id\ttext when pre-filtered to Japanese).
export type TatoebaSentence = { id: string; text: string };

// 5 keeps genuine beginner sentences (猫が好きです。 is 7) while dropping
// fragments; the per-item selection below prefers the shortest anyway.
const MIN_LEN = 5;
const MAX_LEN = 120;
const URL_RE = /https?:\/\//;

// Full Tatoeba JA is ~250k sentences ≈ 2 GB once embedded + HNSW-indexed —
// over Neon free tier's 1 GiB. The drafter only needs examples for the items it
// teaches, so keep each item's K shortest sentences (shortest = most beginner-
// friendly). ~1.5k items × 8 ≈ ≤12k sentences ≈ ~100 MB. See decisions.md
// (Tatoeba corpus cap) for the trade-off and when to raise K.
export const DEFAULT_PER_ITEM = 8;

/** Longest word, in tokens, matched as a compound (日本語 = 日本 + 語). */
const MAX_WINDOW = 4;

export type MatchableItem = {
  id: string;
  type: string;
  display: string;
  reading?: string | null;
  data?: unknown;
};

// Non-independent *nouns* (はず, 以上, 以内 — 名詞,非自立) are real vocab items,
// so only auxiliaries and non-independent verbs / adjectives are excluded.
const isGrammatical = (t: { pos: string; pos_detail_1: string }) =>
  t.pos === '助動詞' ||
  ((t.pos === '動詞' || t.pos === '形容詞') && t.pos_detail_1 === '非自立');

/** Returns the ids of the items a sentence genuinely contains. */
export type ItemMatcher = (text: string) => Set<string>;

/**
 * Token-aligned matcher (kuromoji / IPADIC):
 *  - VOCAB: a run of 1–4 tokens whose surfaces concatenate to one of the
 *    item's spellings — with the last token also tried in dictionary form, so
 *    conjugations match (食べました → 食べる, おいしかった → おいしい). Being
 *    token-aligned, ある no longer matches inside あるいは, nor その inside そのまま.
 *  - A word never *starts* at a grammatical token: auxiliaries (助動詞 — the
 *    ない of 食べない) and non-independent verbs/adjectives (非自立 — the いる
 *    of 読んでいる, the ある of 書いてある) are grammar, not the vocab items
 *    ない / いる / ある.
 *  - KANJI: the character appears anywhere (any word using it is an example).
 * Spellings: the display, standard kanji writing forms and — for words shown in
 * kana — their kana readings (いい/よい).
 */
export function buildItemMatcher(
  items: MatchableItem[],
  tokenizer: JapaneseTokenizer,
): ItemMatcher {
  const vocab = new Map<string, Set<string>>();
  const kanji = new Map<string, string>();
  const addKey = (key: string, id: string) => {
    if (!key) return;
    const ids = vocab.get(key);
    if (ids) ids.add(id);
    else vocab.set(key, new Set([id]));
  };

  for (const item of items) {
    if (item.type === 'KANJI') {
      kanji.set(item.display, item.id);
      continue;
    }
    const d = (item.data ?? {}) as {
      writing_forms?: string[];
      readings?: string[];
    };
    addKey(item.display, item.id);
    for (const form of d.writing_forms ?? []) addKey(form, item.id);
    if (!hasKanji(item.display)) {
      if (item.reading) addKey(item.reading, item.id);
      for (const r of d.readings ?? []) addKey(r, item.id);
    }
  }

  return (text: string) => {
    const hits = new Set<string>();
    for (const ch of text) {
      const id = kanji.get(ch);
      if (id) hits.add(id);
    }
    const tokens = tokenizer.tokenize(text);
    for (let i = 0; i < tokens.length; i++) {
      if (isGrammatical(tokens[i])) continue;
      let surfaces = '';
      for (let n = 0; n < MAX_WINDOW && i + n < tokens.length; n++) {
        const last = tokens[i + n];
        const asWritten = surfaces + last.surface_form;
        const asDictionary =
          last.basic_form && last.basic_form !== '*'
            ? surfaces + last.basic_form
            : asWritten;
        for (const key of [asWritten, asDictionary]) {
          for (const id of vocab.get(key) ?? []) hits.add(id);
        }
        surfaces = asWritten;
      }
    }
    return hits;
  };
}

/**
 * Keep a sentence iff it is among the `perItem` shortest sentences for at least
 * one item it contains. Deterministic: ties break on Tatoeba id.
 */
export function selectForItems(
  sentences: TatoebaSentence[],
  match: ItemMatcher,
  perItem: number,
): TatoebaSentence[] {
  const sorted = [...sentences].sort(
    (a, b) =>
      a.text.length - b.text.length ||
      Number(a.id) - Number(b.id) ||
      a.id.localeCompare(b.id),
  );
  const counts = new Map<string, number>();
  const kept: TatoebaSentence[] = [];

  for (const s of sorted) {
    const wanted = [...match(s.text)].filter(
      (id) => (counts.get(id) ?? 0) < perItem,
    );
    if (wanted.length === 0) continue;
    kept.push(s);
    for (const id of wanted) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return kept;
}

export function parseTatoeba(
  raw: string,
  preFiltered = false,
): TatoebaSentence[] {
  const lines = raw.split('\n').filter(Boolean);
  const result: TatoebaSentence[] = [];

  for (const line of lines) {
    const cols = line.split('\t');
    let id: string;
    let lang: string | undefined;
    let text: string;

    if (preFiltered) {
      // Format: id\ttext
      if (cols.length < 2) continue;
      [id, text] = [cols[0], cols.slice(1).join('\t')];
    } else {
      // Format: id\tlang\ttext (full Tatoeba sentences.csv)
      if (cols.length < 3) continue;
      [id, lang, text] = [cols[0], cols[1], cols.slice(2).join('\t')];
      if (lang !== 'jpn') continue;
    }

    text = text.trim();
    if (text.length < MIN_LEN || text.length > MAX_LEN) continue;
    if (URL_RE.test(text)) continue;

    result.push({ id: id.trim(), text });
  }

  return result;
}

const docId = (s: TatoebaSentence) => `tatoeba-${s.id}`;

/**
 * Sync the `tatoeba` slice of ReferenceDoc to the current selection: embed and
 * upsert sentences that are new or whose text changed upstream (Tatoeba fixes
 * typos), and — only with `prune` — delete stored ones the selection no longer
 * keeps (e.g. after lowering --per-item, or rows from an older uncapped run).
 * Pruning is opt-in so a trial run on a sample file can't wipe the corpus.
 */
export async function ingestTatoeba(
  prisma: PrismaClient,
  voyage: VoyageClient,
  sourcePath: string,
  preFiltered = false,
  perItem = DEFAULT_PER_ITEM,
  options: { prune?: boolean; tokenizer?: JapaneseTokenizer } = {},
): Promise<void> {
  if (!voyage.enabled) {
    throw new Error('VOYAGE_API_KEY is required for ingest:refs tatoeba.');
  }

  if (!Number.isInteger(perItem) || perItem < 1) {
    throw new Error(`--per-item must be a positive integer (got ${perItem}).`);
  }

  const raw = fs.readFileSync(sourcePath, 'utf-8');
  const parsed = parseTatoeba(raw, preFiltered);

  if (parsed.length === 0) {
    throw new Error(
      `No Japanese sentences found in ${sourcePath}. Check the file format (see docs/ingest.md).`,
    );
  }

  const items = await prisma.item.findMany({
    where: { language: 'ja', type: { in: ['VOCAB', 'KANJI'] } },
    select: { id: true, type: true, display: true, reading: true, data: true },
  });
  if (items.length === 0) {
    throw new Error(
      'No VOCAB/KANJI items in the DB to select example sentences for — run `ingest:items vocab` and `ingest:items kanji` first.',
    );
  }

  const matcher = buildItemMatcher(
    items,
    options.tokenizer ?? (await buildTokenizer()),
  );
  const selected = selectForItems(parsed, matcher, perItem);
  const keepIds = new Set(selected.map(docId));

  const stored = await prisma.$queryRaw<{ id: string; text: string }[]>`
    SELECT id, text FROM "ReferenceDoc" WHERE source = 'tatoeba'
  `;
  const storedText = new Map(stored.map((r) => [r.id, r.text]));
  const toEmbed = selected.filter((s) => storedText.get(docId(s)) !== s.text);
  const stale = stored.map((r) => r.id).filter((id) => !keepIds.has(id));

  console.log(
    `ingest:refs tatoeba — ${parsed.length} sentences after filtering; selected ${selected.length} (≤${perItem} per item across ${items.length} items): ${toEmbed.length} new or changed, ${selected.length - toEmbed.length} unchanged, ${stale.length} stored but no longer selected`,
  );

  if (toEmbed.length) {
    const { embeddings, totalTokens } = await voyage.embedAll(
      toEmbed.map((s) => s.text),
    );
    const costUsd = (totalTokens / 1_000_000) * 0.06;
    console.log(`  Voyage: ${totalTokens} tokens (~$${costUsd.toFixed(4)})`);

    await upsertRefDocs(
      prisma,
      toEmbed.map((s, i) => ({
        id: docId(s),
        source: 'tatoeba',
        language: 'ja',
        text: s.text,
        embedding: embeddings[i],
        metadata: { tatoeba_id: s.id },
      })),
    );
  }

  if (stale.length && options.prune) {
    await prisma.$executeRaw`
      DELETE FROM "ReferenceDoc"
      WHERE source = 'tatoeba' AND id = ANY(${stale}::text[])
    `;
  } else if (stale.length) {
    console.warn(
      `  ${stale.length} stored sentence(s) are no longer selected — rerun with --prune to delete them.`,
    );
  }

  console.log(
    `ingest:refs tatoeba — embedded ${toEmbed.length}${options.prune ? `, pruned ${stale.length}` : ''}; ${selected.length} selected docs in the corpus`,
  );
}
