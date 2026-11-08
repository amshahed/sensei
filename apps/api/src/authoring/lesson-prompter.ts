import { PrismaClient } from '@prisma/client';
import type { AnthropicLike } from '../llm/anthropic-llm-client';
import type { VoyageClient } from '../voyage/voyage-client';
import type { Lesson } from './skeleton-schema';
import type { CourseContext } from './course-context';
import { scriptProblems } from './course-rules';
import {
  LessonDraftSchema,
  CritiqueSchema,
  CRITIQUE_CHECKLIST,
  type LessonDraft,
  type CorrectionEntry,
} from './lesson-schema';
import {
  assertComplete,
  authoringModel,
  criticModel,
  parseLlmJson,
} from './authoring-llm';

const DRAFT_MAX_TOKENS = 8000;
const CRITIQUE_MAX_TOKENS = 2048;

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
  /** The reading the item was matched on (何 → なん), not JMdict's first kana. */
  reading?: string | null;
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
    select: { id: true, display: true, reading: true, type: true, data: true },
  });
}

function formatItemsForPrompt(
  items: RawItem[],
  ctx?: CourseContext | null,
): string {
  const surfaceOf = new Map(ctx?.targets.map((t) => [t.id, t.surface]));
  return items
    .map((item) => {
      const surface = surfaceOf.get(item.id);
      if (item.type === 'KANA') {
        const d = item.data as { romaji?: string };
        const romaji = d.romaji ?? '';
        return `${item.id}(${item.display}${romaji ? `・${romaji}` : ''})`;
      }
      if (item.type === 'VOCAB') {
        const d = item.data as { readings?: string[]; senses?: string[] };
        const reading = item.reading ?? d.readings?.[0] ?? '';
        const gloss = d.senses?.[0] ?? '';
        // With course context the word is only ever shown in kana (G.4.c).
        if (surface) return `${item.id}(${surface}・${gloss})`;
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
        return `${item.id}(${surface ?? d.pattern_name ?? item.display}${prereqs})`;
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
): Promise<ReferencePassage[]> {
  const embStr = `[${embedding.join(',')}]`;
  return prisma.$queryRaw<ReferencePassage[]>`
    SELECT text, source FROM "ReferenceDoc"
    ORDER BY embedding <=> ${embStr}::vector
    LIMIT ${k}
  `;
}

export type ReferencePassage = { text: string; source?: string };

/**
 * What the drafter may be shown. A Tatoeba sentence that uses sounds or kanji
 * the learner hasn't met would tempt it to copy them, so it is dropped; a
 * grammar reference only explains, so it stays, marked as not to be copied.
 */
export function passagesFor(
  passages: ReferencePassage[],
  ctx?: CourseContext | null,
): string[] {
  if (!ctx) return passages.map((p) => p.text);
  return passages.flatMap((p) => {
    if (p.source === 'grammar-ref') {
      return [`(reference only, do not copy its Japanese) ${p.text}`];
    }
    return scriptProblems(p.text, ctx).length > 0 ? [] : [p.text];
  });
}

/** The prompt section that holds a draft to what the learner has met (F.2.a). */
function courseContextBlock(ctx: CourseContext): string {
  const list = (items: string[]) => (items.length ? items.join(' ') : '(none)');
  const longVowels = ctx.longVowelsTaught
    ? 'Long vowels: taught.'
    : 'Long vowels: NOT taught yet. Do not use a word with a held vowel.';
  const kanji =
    ctx.lessonType === 'F-Kanji'
      ? `KANJI THE LEARNER HAS MET: ${list(ctx.kanji)}. Use no other kanji.`
      : 'KANJI: none. This is not a kanji lesson, so write everything in kana.';
  const cards =
    ctx.kanaCards.length > 0
      ? `\nKANA CARDS: add one "kana" teach block for each of these, with exactly this char and romaji and no itemId:\n  ${ctx.kanaCards
          .map((c) => `${c.char} = ${c.romaji}`)
          .join('\n  ')}\n`
      : '';
  const typed = ctx.typedReading
    ? `\nTYPED READING: for every target item, include a check with answerType "typed". Its prompt shows the word in kana and contains no rōmaji for it. Its correctAnswer is the word in kana.\n`
    : '';
  const note = ctx.authorNote ? `\nAUTHOR NOTE: ${ctx.authorNote}\n` : '';
  // A reading lesson on kana comes before there are words to list.
  const kanaReading =
    ctx.hasKanaTargets && ctx.lessonType.startsWith('I-')
      ? '\n- This lesson practises reading kana: you may also use simple everyday words spelled only with the kana listed above'
      : '';

  return `
COURSE CONTEXT: this is lesson ${ctx.position} of ${ctx.totalLessons}. The learner knows ONLY what is listed here.
KANA THE LEARNER CAN READ: ${list(ctx.kana)}
${longVowels}
GRAMMAR TAUGHT SO FAR: ${list(ctx.grammar.map((g) => g.surface))}
WORDS THE LEARNER KNOWS: ${list(ctx.words)}
${kanji}
${note}${cards}${typed}
Course rules:
- Every piece of Japanese you write (examples, passages, questions, choices, answers, hints) uses only the kana, grammar and words listed above
- Write Japanese in kana, with a space between words
- Kanji appear only in F-Kanji lessons${kanaReading}
- A question with no single right answer has answerType "typed", grading "open", a model answer as correctAnswer, and a rubric saying what to look for
`;
}

export function buildDraftPrompt(
  lesson: Lesson,
  items: RawItem[],
  passages: string[],
  corrections: CorrectionEntry[],
  ctx?: CourseContext | null,
): string {
  const itemsBlock = formatItemsForPrompt(items, ctx);
  const contextBlock = ctx ? courseContextBlock(ctx) : '';

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
${contextBlock}${passagesBlock}${correctionsBlock}
OUTPUT the lesson draft as JSON matching this exact shape (no other text):
{
  "lessonId": "${lesson.id}",
  "lessonType": "${lesson.type}",
  "title": "${lesson.title}",
  "targetItemIds": ${JSON.stringify(lesson.itemIds)},
  "teach": {
    "blocks": [
      { "type": "text", "text": "A short prose introduction..." },
      { "type": "kana", "char": "あ", "romaji": "a", "itemId": "ja:kana:a", "hint": "Open mouth, no lips" },
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
- For F-Kana lessons: include one "kana" block per target kana character with its char, romaji, itemId, and an optional hint
- A "kana" block in any other lesson is a sound card: it has no itemId
- Available teach block types: text, kana, example, mnemonic, audio, passage`;
}

export type GenerateDraftResult = {
  draft: LessonDraft;
  items: RawItem[];
  inputTokens: number;
  outputTokens: number;
};

export async function generateDraft(
  anthropic: AnthropicLike,
  voyage: VoyageClient,
  prisma: PrismaClient,
  lesson: Lesson,
  corrections: CorrectionEntry[],
  ctx?: CourseContext | null,
): Promise<GenerateDraftResult> {
  const model = authoringModel();
  const items = await loadLessonItems(prisma, lesson.itemIds);

  let passages: string[] = [];
  if (voyage.enabled) {
    const queryText = buildVectorQuery(lesson, items);
    const { embeddings } = await voyage.embedAll([queryText]);
    if (embeddings[0]) {
      passages = passagesFor(
        await searchPassages(prisma, embeddings[0], TOP_K_PASSAGES),
        ctx,
      );
    }
  }

  const userPrompt = buildDraftPrompt(
    lesson,
    items,
    passages,
    corrections,
    ctx,
  );

  // No sampling parameters: current Opus models reject `temperature`.
  const res = await anthropic.messages.create({
    model,
    max_tokens: DRAFT_MAX_TOKENS,
    system: DRAFTER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });
  assertComplete(res, 'Drafter', DRAFT_MAX_TOKENS);

  const inputTokens = res.usage?.input_tokens ?? 0;
  const outputTokens = res.usage?.output_tokens ?? 0;

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

export function buildCritiquePrompt(
  draft: LessonDraft,
  ctx?: CourseContext | null,
): string {
  const taught = ctx
    ? ` Japanese may use only the grammar taught so far: ${ctx.grammar.map((g) => g.surface).join(' ') || '(none yet)'}`
    : '';
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
- learner-confusion: no unexplained jargon; concepts build on each other.${taught}

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
  ctx?: CourseContext | null,
): Promise<GenerateCritiqueResult> {
  const model = criticModel();
  const userPrompt = buildCritiquePrompt(draft, ctx);

  // temperature 0 keeps the gate repeatable: the same draft gets the same
  // verdict. Haiku accepts it; only the Opus drafter can't take it.
  const res = await anthropic.messages.create({
    model,
    max_tokens: CRITIQUE_MAX_TOKENS,
    temperature: 0,
    system: CRITIC_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });
  assertComplete(res, 'Critic', CRITIQUE_MAX_TOKENS);

  const inputTokens = res.usage?.input_tokens ?? 0;
  const outputTokens = res.usage?.output_tokens ?? 0;

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
