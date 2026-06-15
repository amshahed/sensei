import { PrismaClient } from '@prisma/client';
import type { AnthropicLike } from '../llm/anthropic-llm-client';
import { SkeletonSchema, type Skeleton } from './skeleton-schema';

const SYSTEM_PROMPT = `You are a Japanese curriculum architect for a mobile language-learning app.
Your task is to design a lesson skeleton for a Foundation Japanese module.
You output ONLY valid JSON — no markdown, no explanation, no code fences.
The JSON must conform exactly to the schema provided.`;

const MAX_VOCAB_FOR_PROMPT = 200;

type RawItem = {
  id: string;
  display: string;
  data: unknown;
};

type ItemData = {
  kana: RawItem[];
  grammar: RawItem[];
  vocab: RawItem[];
  kanji: RawItem[];
};

export async function loadItemData(prisma: PrismaClient): Promise<ItemData> {
  const [kana, grammar, vocab, kanji] = await Promise.all([
    prisma.item.findMany({
      where: { language: 'ja', type: 'KANA' },
      select: { id: true, display: true, data: true },
      orderBy: { id: 'asc' },
    }),
    prisma.item.findMany({
      where: { language: 'ja', type: 'GRAMMAR' },
      select: { id: true, display: true, data: true },
      orderBy: { id: 'asc' },
    }),
    prisma.item.findMany({
      where: { language: 'ja', type: 'VOCAB' },
      select: { id: true, display: true, data: true },
      take: MAX_VOCAB_FOR_PROMPT,
      orderBy: { createdAt: 'asc' },
    }),
    prisma.item.findMany({
      where: { language: 'ja', type: 'KANJI' },
      select: { id: true, display: true, data: true },
      orderBy: { id: 'asc' },
    }),
  ]);
  return { kana, grammar, vocab, kanji };
}

function formatKana(items: RawItem[]): string {
  return items.map((k) => `${k.id}(${k.display})`).join(', ');
}

function formatGrammar(items: RawItem[]): string {
  return items
    .map((g) => {
      const d = g.data as {
        pattern_name?: string;
        jlpt_level?: string;
        prereqs?: string[];
      };
      const prereqs = d.prereqs?.length
        ? ` prereqs:[${d.prereqs.join(',')}]`
        : '';
      return `${g.id}(${d.pattern_name ?? g.display}${prereqs})`;
    })
    .join('\n  ');
}

function formatVocab(items: RawItem[]): string {
  return items
    .map((v) => {
      const d = v.data as {
        readings?: string[];
        senses?: string[];
      };
      const reading = d.readings?.[0] ?? '';
      const gloss = d.senses?.[0] ?? '';
      return `${v.id}(${v.display}・${reading}・${gloss})`;
    })
    .join(', ');
}

function formatKanji(items: RawItem[]): string {
  return items
    .map((k) => {
      const d = k.data as { meanings?: string[]; on_readings?: string[] };
      const meaning = d.meanings?.[0] ?? '';
      return `${k.id}(${k.display}・${meaning})`;
    })
    .join(', ');
}

function buildUserPrompt(moduleId: string, data: ItemData): string {
  const totalItems =
    data.kana.length +
    data.grammar.length +
    data.vocab.length +
    data.kanji.length;

  return `Design a ~100-lesson Foundation Japanese module (id: "${moduleId}") targeting early N5 — the "introduce yourself in basic Japanese" milestone.

CONSTRAINTS:
- Each lesson: 1 main concept, 3–8 minutes, estimatedMinutes 5–10
- Chapters: 8–15 lessons each, thematically coherent
- Lesson types: F-Kana, F-Vocab, F-Kanji, F-Grammar (for Foundational lessons); I-Listening, I-Reading, I-Writing, I-Speaking (for Integration lessons)
- Kana should be covered first (prerequisite for everything else), grouped by script row
- Grammar must respect prerequisite order — do not use a pattern before its prereqs appear
- Aim for ~100 lessons total (can be 90–110)
- Every itemId referenced must come from the lists below

AVAILABLE ITEMS (${totalItems} total):

KANA (${data.kana.length}):
  ${formatKana(data.kana)}

GRAMMAR (${data.grammar.length}):
  ${formatGrammar(data.grammar)}

VOCAB (${data.vocab.length} shown of available):
  ${formatVocab(data.vocab)}

KANJI (${data.kanji.length}):
  ${formatKanji(data.kanji)}

OUTPUT the skeleton as JSON matching this exact shape (no other text):
{
  "module": {
    "id": "${moduleId}",
    "title": "Foundation Japanese",
    "language": "ja",
    "chapters": [
      {
        "id": "${moduleId}-ch01",
        "title": "Hiragana Vowels",
        "lessons": [
          {
            "id": "${moduleId}-ch01-l01",
            "type": "F-Kana",
            "title": "The Five Vowels",
            "itemIds": ["ja:kana:a", "ja:kana:i", "ja:kana:u", "ja:kana:e", "ja:kana:o"],
            "estimatedMinutes": 7
          }
        ]
      }
    ]
  },
  "generatedAt": "<ISO8601 timestamp>",
  "model": "<model name used>",
  "tokenUsage": { "inputTokens": 0, "outputTokens": 0 }
}`;
}

export type GenerateSkeletonResult = {
  skeleton: Skeleton;
  inputTokens: number;
  outputTokens: number;
};

export async function generateSkeleton(
  anthropic: AnthropicLike,
  moduleId: string,
  data: ItemData,
): Promise<GenerateSkeletonResult> {
  const model = process.env['LLM_AUTHORING_MODEL'] ?? 'claude-opus-4-8';
  const userPrompt = buildUserPrompt(moduleId, data);

  const res = await anthropic.messages.create({
    model,
    max_tokens: 16384,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const inputTokens =
    (res as { usage?: { input_tokens?: number } }).usage?.input_tokens ?? 0;
  const outputTokens =
    (res as { usage?: { output_tokens?: number } }).usage?.output_tokens ?? 0;

  const raw = res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim();

  // Strip markdown code fences the LLM may add despite instructions
  const text = raw
    .replace(/^```[\w]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      `LLM returned non-JSON output (first 200 chars): ${text.slice(0, 200)}`,
    );
  }

  if (parsed && typeof parsed === 'object') {
    const p = parsed as Record<string, unknown>;
    // Always overwrite with actual timestamp — LLM echoes a placeholder literal
    p['generatedAt'] = new Date().toISOString();
    // Patch in actual token usage if LLM left placeholder zeros
    if (p['tokenUsage'] && typeof p['tokenUsage'] === 'object') {
      const tu = p['tokenUsage'] as Record<string, unknown>;
      if (!tu['inputTokens'] || tu['inputTokens'] === 0)
        tu['inputTokens'] = inputTokens;
      if (!tu['outputTokens'] || tu['outputTokens'] === 0)
        tu['outputTokens'] = outputTokens;
    }
  }

  const skeleton = SkeletonSchema.parse(parsed);
  return { skeleton, inputTokens, outputTokens };
}
