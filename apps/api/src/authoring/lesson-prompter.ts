import { PrismaClient } from '@prisma/client';
import type { AnthropicLike } from '../llm/anthropic-llm-client';
import type { VoyageClient } from '../voyage/voyage-client';
import type { Lesson } from './skeleton-schema';
import {
  LessonDraftSchema,
  CritiqueSchema,
  CRITIQUE_CHECKLIST,
  type LessonDraft,
  type CorrectionEntry,
} from './lesson-schema';

const DRAFTER_SYSTEM_PROMPT = `You are a Japanese lesson author for a mobile language-learning app.
Design lesson content for Foundation Japanese targeting early N5 learners.
Output ONLY valid JSON — no markdown, no explanation, no code fences.
The JSON must conform exactly to the schema provided.
Voice: friendly, encouraging, direct. Not academic. Speak to the learner.`;

const CRITIC_SYSTEM_PROMPT = `You are a quality reviewer for a Japanese language-learning app.
Evaluate a lesson draft against a 9-point checklist and output ONLY valid JSON.
No markdown, no explanation, no code fences.`;

const TOP_K_PASSAGES = 5;

export type RawItem = {
  id: string;
  display: string;
  type: string;
  data: unknown;
};

/** Load specific items by ID for a lesson draft. */
export async function loadLessonItems(
  prisma: PrismaClient,
  itemIds: string[],
): Promise<RawItem[]> {
  return prisma.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, display: true, type: true, data: true },
  });
}

function formatItemsForPrompt(items: RawItem[]): string {
  return items
    .map((item) => {
      if (item.type === 'KANA') {
        const d = item.data as { romaji?: string };
        const romaji = d.romaji ?? '';
        return `${item.id}(${item.display}${romaji ? `・${romaji}` : ''})`;
      }
      if (item.type === 'VOCAB') {
        const d = item.data as { readings?: string[]; senses?: string[] };
        const reading = d.readings?.[0] ?? '';
        const gloss = d.senses?.[0] ?? '';
        return `${item.id}(${item.display}・${reading}・${gloss})`;
      }
      if (item.type === 'KANJI') {
        const d = item.data as { meanings?: string[] };
        const meaning = d.meanings?.[0] ?? '';
        return `${item.id}(${item.display}・${meaning})`;
      }
      if (item.type === 'GRAMMAR') {
        const d = item.data as { pattern_name?: string; prereqs?: string[] };
        const prereqs = d.prereqs?.length
          ? ` prereqs:[${d.prereqs.join(',')}]`
          : '';
        return `${item.id}(${d.pattern_name ?? item.display}${prereqs})`;
      }
      return `${item.id}(${item.display})`;
    })
    .join('\n  ');
}

/** Build a query string for vector search from lesson metadata. */
export function buildVectorQuery(lesson: Lesson, items: RawItem[]): string {
  const displays = items.map((i) => i.display).join(' ');
  return `Japanese ${lesson.type} lesson: ${lesson.title} — ${displays}`;
}

/** Query pgvector for the closest reference passages to a query embedding. */
export async function searchPassages(
  prisma: PrismaClient,
  embedding: number[],
  k: number,
): Promise<string[]> {
  const embStr = `[${embedding.join(',')}]`;
  const rows = await prisma.$queryRaw<Array<{ text: string }>>`
    SELECT text FROM "ReferenceDoc"
    ORDER BY embedding <=> ${embStr}::vector
    LIMIT ${k}
  `;
  return rows.map((r) => r.text);
}

export function buildDraftPrompt(
  lesson: Lesson,
  items: RawItem[],
  passages: string[],
  corrections: CorrectionEntry[],
): string {
  const itemsBlock = formatItemsForPrompt(items);

  const passagesBlock =
    passages.length > 0
      ? `\nRELEVANT CORPUS EXAMPLES (use sparingly as inspiration):\n${passages.map((p, i) => `  [${i + 1}] ${p.slice(0, 300)}`).join('\n')}\n`
      : '';

  const correctionsBlock =
    corrections.length > 0
      ? `\nRECENT CORRECTIONS (${lesson.type}, most recent first — apply these lessons):\n${corrections
          .slice()
          .reverse()
          .map((c, i) => `  [${i + 1}] "${c.notes}"`)
          .join('\n')}\n`
      : '';

  return `Draft a ${lesson.type} lesson for Foundation Japanese.

LESSON: ${lesson.id} — "${lesson.title}"
ESTIMATED MINUTES: ${lesson.estimatedMinutes}
TARGET ITEMS (${items.length}):
  ${itemsBlock}
${passagesBlock}${correctionsBlock}
OUTPUT the lesson draft as JSON matching this exact shape (no other text):
{
  "lessonId": "${lesson.id}",
  "lessonType": "${lesson.type}",
  "title": "${lesson.title}",
  "targetItemIds": ${JSON.stringify(lesson.itemIds)},
  "teach": {
    "blocks": [
      { "type": "text", "md": "## Lesson introduction\\n..." },
      { "type": "example", "japanese": "...", "reading": "...", "translation": "..." },
      { "type": "mnemonic", "text": "..." },
      { "type": "audio", "src": "audio/${lesson.type.toLowerCase()}/${lesson.id}.mp3", "label": "..." },
      { "type": "passage", "text": "...", "title": "Read this" }
    ]
  },
  "practice": {
    "templates": [
      { "targetItemId": "${lesson.itemIds[0] ?? ''}",  "mode": "recognition", "hint": "..." }
    ]
  },
  "check": {
    "questions": [
      {
        "id": "q1",
        "targetItemId": "${lesson.itemIds[0] ?? ''}",
        "prompt": "...",
        "answerType": "multiple-choice",
        "choices": ["a", "b", "c", "d"],
        "correctAnswer": "a",
        "explanation": "..."
      }
    ]
  },
  "meta": {
    "generatedAt": "<ISO8601 timestamp>",
    "model": "<model>",
    "tokenUsage": { "inputTokens": 0, "outputTokens": 0 }
  }
}

Rules:
- Produce at least 2 teach blocks, 1 practice template per target item, 2 check questions per target item
- Multiple-choice questions must include exactly 4 choices
- Audio src must be a relative placeholder path (e.g. "audio/kana/a.mp3")
- All targetItemIds in questions/templates must be from the TARGET ITEMS list above
- For I-Reading lessons: open with a "passage" block containing the reading text, then use "text" blocks for comprehension guidance; check questions test the passage content (multiple-choice or typed)
- Available teach block types: text, example, mnemonic, audio, passage`;
}

export type GenerateDraftResult = {
  draft: LessonDraft;
  items: RawItem[];
  inputTokens: number;
  outputTokens: number;
};

function parseLlmJson(raw: string, callerLabel: string): unknown {
  const text = raw
    .replace(/^```[\w]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      `${callerLabel} returned non-JSON output (first 200 chars): ${text.slice(0, 200)}`,
    );
  }
}

export async function generateDraft(
  anthropic: AnthropicLike,
  voyage: VoyageClient,
  prisma: PrismaClient,
  lesson: Lesson,
  corrections: CorrectionEntry[],
): Promise<GenerateDraftResult> {
  const model = process.env['LLM_AUTHORING_MODEL'] ?? 'claude-opus-4-8';
  const items = await loadLessonItems(prisma, lesson.itemIds);

  let passages: string[] = [];
  if (voyage.enabled) {
    const queryText = buildVectorQuery(lesson, items);
    const { embeddings } = await voyage.embedAll([queryText]);
    if (embeddings[0]) {
      passages = await searchPassages(prisma, embeddings[0], TOP_K_PASSAGES);
    }
  }

  const userPrompt = buildDraftPrompt(lesson, items, passages, corrections);

  const res = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    temperature: 0,
    system: DRAFTER_SYSTEM_PROMPT,
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

  const parsed = parseLlmJson(raw, 'Drafter');

  if (parsed && typeof parsed === 'object') {
    const p = parsed as Record<string, unknown>;
    p['meta'] = {
      ...(typeof p['meta'] === 'object' && p['meta'] !== null ? p['meta'] : {}),
      generatedAt: new Date().toISOString(),
      model,
      tokenUsage: {
        inputTokens: inputTokens || 0,
        outputTokens: outputTokens || 0,
      },
    };
  }

  const draft = LessonDraftSchema.parse(parsed);
  return { draft, items, inputTokens, outputTokens };
}

// ── Critic ────────────────────────────────────────────────────────────────────

export function buildCritiquePrompt(draft: LessonDraft): string {
  return `Review this ${draft.lessonType} lesson draft against the 9-point checklist.

LESSON DRAFT:
${JSON.stringify(draft, null, 2)}

CHECKLIST (evaluate each in order):
${CRITIQUE_CHECKLIST.map((name, i) => `  ${i + 1}. ${name}`).join('\n')}

Definitions:
- tone: friendly and encouraging, not academic or dry
- length: teach blocks appropriate for a 5–10 min lesson; not over-stuffed
- flow: Teach → Practice → Check progression is coherent; no abrupt jumps
- example-feel: example sentences feel natural, not textbook (use daily life situations)
- audio: all audio src values are relative placeholder paths (not absolute URLs)
- lesson-type-adherence: content matches lesson type ${draft.lessonType} and item types
- item-ref-match: all targetItemIds in questions/templates declared in targetItemIds list
- theme-tag-accuracy: lesson title matches content; no mislabeled concepts
- learner-confusion: no unexplained jargon; concepts build on each other

OUTPUT only this JSON (no other text):
{
  "lessonId": "${draft.lessonId}",
  "checks": [
    { "name": "tone", "pass": true },
    { "name": "length", "pass": false, "note": "..." }
  ],
  "overallPass": true,
  "summary": "one-sentence summary",
  "meta": {
    "generatedAt": "<ISO8601 timestamp>",
    "model": "<model>",
    "tokenUsage": { "inputTokens": 0, "outputTokens": 0 }
  }
}`;
}

export type GenerateCritiqueResult = {
  critique: import('./lesson-schema').Critique;
  inputTokens: number;
  outputTokens: number;
};

export async function generateCritique(
  anthropic: AnthropicLike,
  draft: LessonDraft,
): Promise<GenerateCritiqueResult> {
  const model = process.env['LLM_CRITIC_MODEL'] ?? 'claude-haiku-4-5-20251001';
  const userPrompt = buildCritiquePrompt(draft);

  const res = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    temperature: 0,
    system: CRITIC_SYSTEM_PROMPT,
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

  const parsed = parseLlmJson(raw, 'Critic');

  if (parsed && typeof parsed === 'object') {
    const p = parsed as Record<string, unknown>;
    p['meta'] = {
      ...(typeof p['meta'] === 'object' && p['meta'] !== null ? p['meta'] : {}),
      generatedAt: new Date().toISOString(),
      model,
      tokenUsage: {
        inputTokens: inputTokens || 0,
        outputTokens: outputTokens || 0,
      },
    };
  }

  const critique = CritiqueSchema.parse(parsed);
  return { critique, inputTokens, outputTokens };
}
