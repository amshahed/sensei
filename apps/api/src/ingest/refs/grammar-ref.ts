import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import { VoyageClient } from '../../voyage/voyage-client';
import { upsertRefDoc } from './upsert-doc';

const AUTHORING_MODEL = 'claude-opus-4-8';

const SYSTEM_PROMPT = `You are a Japanese linguistics reference author.
Write concise, accurate grammar reference passages for a Japanese learning app.
Each passage should explain: (1) what the pattern does, (2) when to use it,
(3) a simple example sentence with romaji and English translation.
Keep the passage under 200 words. Use plain language, not academic jargon.`;

function buildUserPrompt(patternName: string, jlptLevel: string): string {
  return `Write a reference passage for the Japanese grammar pattern: "${patternName}" (${jlptLevel})`;
}

export async function generateGrammarRef(
  anthropic: Anthropic,
  patternName: string,
  jlptLevel: string,
): Promise<string> {
  const res = await anthropic.messages.create({
    model: AUTHORING_MODEL,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: buildUserPrompt(patternName, jlptLevel) },
    ],
  });

  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => ('text' in b ? b.text : ''))
    .join('');

  if (!text)
    throw new Error(`No text returned for grammar pattern: ${patternName}`);
  return text;
}

export async function ingestGrammarRefs(
  prisma: PrismaClient,
  voyage: VoyageClient,
  anthropicApiKey: string,
  /** Test seam: inject a pre-built client instead of constructing one. */
  anthropicClient?: Anthropic,
): Promise<void> {
  if (!voyage.enabled) {
    throw new Error('VOYAGE_API_KEY is required for ingest:refs grammar.');
  }
  if (!anthropicApiKey && !anthropicClient) {
    throw new Error('ANTHROPIC_API_KEY is required for ingest:refs grammar.');
  }

  const anthropic =
    anthropicClient ?? new Anthropic({ apiKey: anthropicApiKey });

  // Load all ingested grammar items.
  const grammarItems = await prisma.item.findMany({
    where: { language: 'ja', type: 'GRAMMAR' },
    select: { id: true, display: true, data: true },
  });

  if (grammarItems.length === 0) {
    throw new Error(
      'No grammar items found in the DB. Run `ingest:items grammar` first.',
    );
  }

  console.log(
    `ingest:refs grammar — generating reference passages for ${grammarItems.length} grammar items...`,
  );

  let totalTokens = 0;
  let upserted = 0;

  for (const item of grammarItems) {
    const data = item.data as { pattern_name?: string; jlpt_level?: string };
    const patternName = data.pattern_name ?? item.display;
    const jlptLevel = data.jlpt_level ?? 'N5';
    const docId = `grammar-ref-${item.id.replace('ja:grammar:', '')}`;

    const passage = await generateGrammarRef(anthropic, patternName, jlptLevel);
    const { embeddings, totalTokens: batchTokens } = await voyage.embedAll([
      passage,
    ]);
    totalTokens += batchTokens;

    await upsertRefDoc(prisma, {
      id: docId,
      source: 'grammar-ref',
      language: 'ja',
      text: passage,
      embedding: embeddings[0],
      metadata: {
        item_id: item.id,
        pattern_name: patternName,
        jlpt_level: jlptLevel,
      },
    });

    upserted++;
    if (upserted % 10 === 0) {
      console.log(`  ${upserted}/${grammarItems.length} done...`);
    }
  }

  const costUsd = (totalTokens / 1_000_000) * 0.06;
  console.log(
    `ingest:refs grammar — upserted ${upserted} docs; ${totalTokens} embed tokens (~$${costUsd.toFixed(4)})`,
  );
}
