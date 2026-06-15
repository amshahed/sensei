import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import type { AnthropicLike } from '../../llm/anthropic-llm-client';
import { VoyageClient } from '../../voyage/voyage-client';
import { upsertRefDoc } from './upsert-doc';

const SYSTEM_PROMPT = `You are a Japanese linguistics reference author.
Write concise, accurate grammar reference passages for a Japanese learning app.
Each passage should explain: (1) what the pattern does, (2) when to use it,
(3) a simple example sentence with romaji and English translation.
Keep the passage under 200 words. Use plain language, not academic jargon.`;

function buildUserPrompt(patternName: string, jlptLevel: string): string {
  return `Write a reference passage for the Japanese grammar pattern: "${patternName}" (${jlptLevel})`;
}

export async function generateGrammarRef(
  anthropic: AnthropicLike,
  patternName: string,
  jlptLevel: string,
): Promise<string> {
  const model = process.env['LLM_AUTHORING_MODEL'] ?? 'claude-opus-4-8';

  const res = await anthropic.messages.create({
    model,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: buildUserPrompt(patternName, jlptLevel) },
    ],
  });

  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');

  if (!text)
    throw new Error(`No text returned for grammar pattern: ${patternName}`);
  return text;
}

export async function ingestGrammarRefs(
  prisma: PrismaClient,
  voyage: VoyageClient,
  anthropicApiKey: string,
  /** Test seam: inject a pre-built AnthropicLike client instead of constructing one. */
  anthropicClient?: AnthropicLike,
): Promise<void> {
  if (!voyage.enabled) {
    throw new Error('VOYAGE_API_KEY is required for ingest:refs grammar.');
  }
  if (!anthropicApiKey && !anthropicClient) {
    throw new Error('ANTHROPIC_API_KEY is required for ingest:refs grammar.');
  }

  const anthropic: AnthropicLike =
    anthropicClient ?? new Anthropic({ apiKey: anthropicApiKey });

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

  type ItemWork = {
    docId: string;
    passage: string;
    patternName: string;
    jlptLevel: string;
    itemId: string;
  };

  // Phase 1: generate all passages (sequential — Anthropic rate-limit is the bottleneck).
  const work: ItemWork[] = [];
  for (const item of grammarItems) {
    const data = item.data as { pattern_name?: string; jlpt_level?: string };
    const patternName = data.pattern_name ?? item.display;
    const jlptLevel = data.jlpt_level ?? 'N5';
    const docId = `grammar-ref-${item.id.replace('ja:grammar:', '')}`;
    const passage = await generateGrammarRef(anthropic, patternName, jlptLevel);
    work.push({ docId, passage, patternName, jlptLevel, itemId: item.id });
    if (work.length % 10 === 0) {
      console.log(
        `  ${work.length}/${grammarItems.length} passages generated...`,
      );
    }
  }

  // Phase 2: embed all passages in one batched call.
  console.log(`  embedding ${work.length} passages...`);
  const { embeddings, totalTokens } = await voyage.embedAll(
    work.map((w) => w.passage),
  );

  // Phase 3: upsert all docs.
  for (let i = 0; i < work.length; i++) {
    const { docId, passage, patternName, jlptLevel, itemId } = work[i];
    await upsertRefDoc(prisma, {
      id: docId,
      source: 'grammar-ref',
      language: 'ja',
      text: passage,
      embedding: embeddings[i],
      metadata: {
        item_id: itemId,
        pattern_name: patternName,
        jlpt_level: jlptLevel,
      },
    });
  }

  const costUsd = (totalTokens / 1_000_000) * 0.06;
  console.log(
    `ingest:refs grammar — upserted ${work.length} docs; ${totalTokens} embed tokens (~$${costUsd.toFixed(4)})`,
  );
}
