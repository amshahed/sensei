import { PrismaClient } from '@prisma/client';
import type { AnthropicLike } from '../llm/anthropic-llm-client';
import { SkeletonSchema, type Skeleton } from './skeleton-schema';
import { assertComplete, authoringModel, parseLlmJson } from './authoring-llm';

/**
 * Room for ~100 lessons of skeleton JSON: the first live run used 14.7k
 * output tokens. Stays under the SDK's non-streaming ceiling (~21k).
 */
const SKELETON_MAX_TOKENS = 20000;

const SYSTEM_PROMPT = `You are a Japanese curriculum architect for a mobile language-learning app.
Your task is to design a lesson skeleton for a Foundation Japanese module.
You output ONLY valid JSON — no markdown, no explanation, no code fences.
The JSON must conform exactly to the schema provided.`;

// The beta targets early N5, so the skeleton sees every N5 word (~640, ~16k
// input tokens) and picks the most useful ~150–200 itself. The cap is only a
// cost guard; the old cap of 200 + createdAt order handed the model the first
// 200 words in あいうえお order rather than the most frequent.
const SKELETON_VOCAB_LEVEL = 'N5';
const MAX_VOCAB_FOR_PROMPT = 1000;

type RawItem = {
  id: string;
  display: string;
  /** The reading the item was matched on (何 → なん), not JMdict's first kana. */
  reading?: string | null;
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
      select: { id: true, display: true, reading: true, data: true },
      orderBy: { id: 'asc' },
    }),
    prisma.item
      .findMany({
        where: { language: 'ja', type: 'GRAMMAR' },
        select: { id: true, display: true, reading: true, data: true },
        orderBy: { id: 'asc' },
      })
      .then(bySourceOrder),
    prisma.item.findMany({
      where: {
        language: 'ja',
        type: 'VOCAB',
        data: { path: ['jlpt'], equals: SKELETON_VOCAB_LEVEL },
      },
      select: { id: true, display: true, reading: true, data: true },
      take: MAX_VOCAB_FOR_PROMPT,
      orderBy: { createdAt: 'asc' },
    }),
    prisma.item.findMany({
      where: { language: 'ja', type: 'KANJI' },
      select: { id: true, display: true, reading: true, data: true },
      orderBy: { id: 'asc' },
    }),
  ]);
  return { kana, grammar, vocab, kanji };
}

/** Grammar in source-list (Tanos) order; items without one sort last by id. */
export function bySourceOrder(items: RawItem[]): RawItem[] {
  const order = (i: RawItem) =>
    (i.data as { source_order?: number } | null)?.source_order ??
    Number.POSITIVE_INFINITY;
  return [...items].sort((a, b) => order(a) - order(b));
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
      const reading = v.reading ?? d.readings?.[0] ?? '';
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

GRAMMAR (${data.grammar.length}, in Tanos list order — a conventional teaching order; use the first ~15–20):
  ${formatGrammar(data.grammar)}

VOCAB (all ${data.vocab.length} JLPT ${SKELETON_VOCAB_LEVEL} words, in no particular order — choose the ~150–200 most frequent and most useful for the milestone):
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
  const model = authoringModel();
  const userPrompt = buildUserPrompt(moduleId, data);

  // No sampling parameters: current Opus models reject `temperature`.
  const res = await anthropic.messages.create({
    model,
    max_tokens: SKELETON_MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });
  assertComplete(res, 'Skeleton', SKELETON_MAX_TOKENS);

  const inputTokens = res.usage?.input_tokens ?? 0;
  const outputTokens = res.usage?.output_tokens ?? 0;

  const raw = res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
  const parsed = parseLlmJson(raw, 'Skeleton');

  if (parsed && typeof parsed === 'object') {
    const p = parsed as Record<string, unknown>;
    // Provenance is ours to record, not the model's to echo: it fills these
    // with placeholders, made-up numbers, or leaves them out.
    p['generatedAt'] = new Date().toISOString();
    p['model'] = model;
    p['tokenUsage'] = { inputTokens, outputTokens };
  }

  const skeleton = SkeletonSchema.parse(parsed);
  return { skeleton, inputTokens, outputTokens };
}
