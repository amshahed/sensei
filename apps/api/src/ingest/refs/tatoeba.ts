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
): Promise<void> {
  if (!voyage.enabled) {
    throw new Error('VOYAGE_API_KEY is required for ingest:refs tatoeba.');
  }

  const raw = fs.readFileSync(sourcePath, 'utf-8');
  const sentences = parseTatoeba(raw, preFiltered);

  if (sentences.length === 0) {
    throw new Error(
      `No Japanese sentences found in ${sourcePath}. Check the file format (see docs/ingest.md).`,
    );
  }

  console.log(
    `ingest:refs tatoeba — ${sentences.length} sentences after filtering; embedding...`,
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
