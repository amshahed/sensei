import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import { VoyageClient } from '../../voyage/voyage-client';
import { upsertRefDoc } from './upsert-doc';

// Tatoeba sentences.csv / jpn_sentences.tsv format: id\tlang\ttext
// (or id\ttext when pre-filtered to Japanese).
export type TatoebaSentence = { id: string; text: string };

const MIN_LEN = 10;
const MAX_LEN = 120;
const URL_RE = /https?:\/\//;

// Full Tatoeba JA is ~200k sentences ≈ 1.7 GB once embedded + HNSW-indexed —
// over Neon free tier's 1 GiB. The drafter only needs examples for the items it
// teaches, so keep each item's K shortest sentences (shortest = most beginner-
// friendly). ~1.3k items × 8 ≈ ≤10k sentences ≈ ~90 MB.
export const DEFAULT_PER_ITEM = 8;

export type MatchKey = { itemId: string; needle: string };

const HAS_KANJI = /[\u4e00-\u9fff]/;
const ENDS_IN_HIRAGANA = /[\u3040-\u309f]$/;

/**
 * Substring needles per item: the item's display form, plus — for words that
 * mix kanji with trailing okurigana (食べる, 行く, 高い) — the form minus its
 * last kana, so conjugations (食べました, 高かった) still match. Stems shorter
 * than 2 chars are skipped (行 would match 銀行, 旅行, …); the kanji items
 * themselves cover single characters.
 */
export function buildMatchKeys(
  items: { id: string; display: string }[],
): MatchKey[] {
  const keys: MatchKey[] = [];
  for (const { id, display } of items) {
    if (!display) continue;
    keys.push({ itemId: id, needle: display });
    if (HAS_KANJI.test(display) && ENDS_IN_HIRAGANA.test(display)) {
      const stem = display.slice(0, -1);
      if (stem.length >= 2) keys.push({ itemId: id, needle: stem });
    }
  }
  return keys;
}

/**
 * Keep a sentence iff it is among the `perItem` shortest sentences for at least
 * one item it contains. Deterministic: ties break on Tatoeba id.
 */
export function selectForItems(
  sentences: TatoebaSentence[],
  keys: MatchKey[],
  perItem: number,
): TatoebaSentence[] {
  const sorted = [...sentences].sort(
    (a, b) =>
      a.text.length - b.text.length ||
      Number(a.id) - Number(b.id) ||
      a.id.localeCompare(b.id),
  );
  const counts = new Map<string, number>();
  let active = keys;
  const kept: TatoebaSentence[] = [];

  for (const s of sorted) {
    if (active.length === 0) break;
    const hitItems = new Set<string>();
    for (const k of active) {
      if (s.text.includes(k.needle)) hitItems.add(k.itemId);
    }
    if (hitItems.size === 0) continue;
    kept.push(s);
    for (const id of hitItems) counts.set(id, (counts.get(id) ?? 0) + 1);
    active = active.filter((k) => (counts.get(k.itemId) ?? 0) < perItem);
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

export async function ingestTatoeba(
  prisma: PrismaClient,
  voyage: VoyageClient,
  sourcePath: string,
  preFiltered = false,
  perItem = DEFAULT_PER_ITEM,
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
    select: { id: true, display: true },
  });
  if (items.length === 0) {
    throw new Error(
      'No VOCAB/KANJI items in the DB to select example sentences for — run `ingest:items vocab` and `ingest:items kanji` first.',
    );
  }

  const sentences = selectForItems(parsed, buildMatchKeys(items), perItem);

  console.log(
    `ingest:refs tatoeba — ${parsed.length} sentences after filtering; kept ${sentences.length} (≤${perItem} per item across ${items.length} items); embedding...`,
  );

  const texts = sentences.map((s) => s.text);
  const { embeddings, totalTokens } = await voyage.embedAll(texts);

  const costUsd = (totalTokens / 1_000_000) * 0.06;
  console.log(`  Voyage: ${totalTokens} tokens (~$${costUsd.toFixed(4)})`);

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    await upsertRefDoc(prisma, {
      id: `tatoeba-${s.id}`,
      source: 'tatoeba',
      language: 'ja',
      text: s.text,
      embedding: embeddings[i],
      metadata: { tatoeba_id: s.id },
    });
  }

  console.log(`ingest:refs tatoeba — upserted ${sentences.length} docs`);
}
