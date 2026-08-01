import {
  loadLessonItems,
  generateDraft,
  generateCritique,
  buildVectorQuery,
} from './lesson-prompter';
import {
  LessonDraftSchema,
  CritiqueSchema,
  CRITIQUE_CHECKLIST,
} from './lesson-schema';
import type { AnthropicLike } from '../llm/anthropic-llm-client';
import type { VoyageClient } from '../voyage/voyage-client';
import { PrismaClient } from '@prisma/client';
import type { Lesson } from './skeleton-schema';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAnthropicFake(response: unknown): {
  fake: AnthropicLike;
  createFn: jest.Mock;
} {
  const createFn = jest.fn().mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify(response) }],
    usage: { input_tokens: 200, output_tokens: 400 },
  });
  return { fake: { messages: { create: createFn } }, createFn };
}

function makeVoyageFake(enabled: boolean): {
  voyage: VoyageClient;
  embedAllFn: jest.Mock;
} {
  const embedAllFn = jest
    .fn()
    .mockResolvedValue({ embeddings: [[0.1, 0.2]], totalTokens: 10 });
  const voyage = { enabled, embedAll: embedAllFn } as unknown as VoyageClient;
  return { voyage, embedAllFn };
}

function makePrisma(
  items: Array<{
    id: string;
    display: string;
    type: string;
    data: unknown;
  }> = [],
): PrismaClient {
  return {
    item: { findMany: jest.fn().mockResolvedValue(items) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  } as unknown as PrismaClient;
}

const TEST_LESSON: Lesson = {
  id: 'foundation-ja-ch01-l01',
  type: 'F-Kana',
  title: 'The Five Vowels',
  itemIds: ['ja:kana:a', 'ja:kana:i'],
  estimatedMinutes: 7,
};

const MINIMAL_DRAFT = {
  lessonId: 'foundation-ja-ch01-l01',
  lessonType: 'F-Kana',
  title: 'The Five Vowels',
  targetItemIds: ['ja:kana:a', 'ja:kana:i'],
  teach: {
    blocks: [
      { type: 'text', text: 'Vowels. Hiragana starts here.' },
      { type: 'audio', src: 'audio/kana/a.mp3', label: 'あ' },
    ],
  },
  practice: {
    templates: [
      { targetItemId: 'ja:kana:a', mode: 'recognition' },
      { targetItemId: 'ja:kana:i', mode: 'recall' },
    ],
  },
  check: {
    questions: [
      {
        id: 'q1',
        targetItemId: 'ja:kana:a',
        prompt: 'What sound is あ?',
        answerType: 'multiple-choice',
        choices: ['a', 'i', 'u', 'e'],
        correctAnswer: 'a',
      },
    ],
  },
  meta: {
    generatedAt: new Date().toISOString(),
    model: 'claude-opus-4-8',
    tokenUsage: { inputTokens: 200, outputTokens: 400 },
  },
};

const MINIMAL_CRITIQUE = {
  lessonId: 'foundation-ja-ch01-l01',
  checks: CRITIQUE_CHECKLIST.map((name) => ({ name, pass: true })),
  overallPass: true,
  summary: 'Good lesson.',
  meta: {
    generatedAt: new Date().toISOString(),
    model: 'claude-haiku-4-5-20251001',
    tokenUsage: { inputTokens: 100, outputTokens: 50 },
  },
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('loadLessonItems', () => {
  it('queries DB for items by IDs', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([
        { id: 'ja:kana:a', display: 'あ', type: 'KANA', data: {} },
      ]);
    const prisma = { item: { findMany } } as unknown as PrismaClient;

    const result = await loadLessonItems(prisma, ['ja:kana:a', 'ja:kana:i']);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['ja:kana:a', 'ja:kana:i'] } },
      }),
    );
    expect(result).toHaveLength(1);
  });
});

describe('buildVectorQuery', () => {
  it('includes lesson type, title, and item displays', () => {
    const items = [
      { id: 'ja:kana:a', display: 'あ', type: 'KANA', data: {} },
      { id: 'ja:kana:i', display: 'い', type: 'KANA', data: {} },
    ];
    const query = buildVectorQuery(TEST_LESSON, items);
    expect(query).toContain('F-Kana');
    expect(query).toContain('Five Vowels');
    expect(query).toContain('あ');
  });
});

describe('generateDraft', () => {
  it('returns a validated draft with token counts', async () => {
    const { fake, createFn } = makeAnthropicFake(MINIMAL_DRAFT);
    const { voyage } = makeVoyageFake(false); // disabled — skip vector search
    const prisma = makePrisma([
      { id: 'ja:kana:a', display: 'あ', type: 'KANA', data: {} },
      { id: 'ja:kana:i', display: 'い', type: 'KANA', data: {} },
    ]);

    const result = await generateDraft(fake, voyage, prisma, TEST_LESSON, []);

    expect(() => LessonDraftSchema.parse(result.draft)).not.toThrow();
    expect(result.draft.lessonId).toBe('foundation-ja-ch01-l01');
    expect(result.items).toBeDefined();
    expect(result.inputTokens).toBe(200);
    expect(result.outputTokens).toBe(400);
    expect(createFn).toHaveBeenCalledTimes(1);
  });

  it('calls LLM with temperature:0 and correct model', async () => {
    const { fake, createFn } = makeAnthropicFake(MINIMAL_DRAFT);
    const { voyage } = makeVoyageFake(false);
    const prisma = makePrisma();

    await generateDraft(fake, voyage, prisma, TEST_LESSON, []);

    const callBody = (
      createFn.mock.calls as Array<[{ temperature: number; model: string }]>
    )[0][0];
    expect(callBody.temperature).toBe(0);
    expect(callBody.model).toBe(
      process.env['LLM_AUTHORING_MODEL'] ?? 'claude-opus-4-8',
    );
  });

  it('skips vector search when voyage is disabled', async () => {
    const { fake } = makeAnthropicFake(MINIMAL_DRAFT);
    const { voyage, embedAllFn } = makeVoyageFake(false);
    const prisma = makePrisma([
      { id: 'ja:kana:a', display: 'あ', type: 'KANA', data: {} },
      { id: 'ja:kana:i', display: 'い', type: 'KANA', data: {} },
    ]);

    await generateDraft(fake, voyage, prisma, TEST_LESSON, []);

    expect(embedAllFn).not.toHaveBeenCalled();
  });

  it('calls vector search when voyage is enabled', async () => {
    const { fake } = makeAnthropicFake(MINIMAL_DRAFT);
    const { voyage, embedAllFn } = makeVoyageFake(true);
    const prisma = makePrisma([
      { id: 'ja:kana:a', display: 'あ', type: 'KANA', data: {} },
      { id: 'ja:kana:i', display: 'い', type: 'KANA', data: {} },
    ]);

    await generateDraft(fake, voyage, prisma, TEST_LESSON, []);

    expect(embedAllFn).toHaveBeenCalledTimes(1);
  });

  it('throws on non-JSON LLM output', async () => {
    const createFn = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Sorry, cannot help.' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const fake: AnthropicLike = { messages: { create: createFn } };
    const { voyage } = makeVoyageFake(false);
    const prisma = makePrisma();

    await expect(
      generateDraft(fake, voyage, prisma, TEST_LESSON, []),
    ).rejects.toThrow('non-JSON output');
  });

  it('strips markdown fences before parsing', async () => {
    const fenced = `\`\`\`json\n${JSON.stringify(MINIMAL_DRAFT)}\n\`\`\``;
    const createFn = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: fenced }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const fake: AnthropicLike = { messages: { create: createFn } };
    const { voyage } = makeVoyageFake(false);
    const prisma = makePrisma([
      { id: 'ja:kana:a', display: 'あ', type: 'KANA', data: {} },
      { id: 'ja:kana:i', display: 'い', type: 'KANA', data: {} },
    ]);

    const result = await generateDraft(fake, voyage, prisma, TEST_LESSON, []);
    expect(result.draft.lessonId).toBe('foundation-ja-ch01-l01');
  });

  it('overwrites generatedAt with server timestamp', async () => {
    const draftWithPlaceholder = {
      ...MINIMAL_DRAFT,
      meta: { ...MINIMAL_DRAFT.meta, generatedAt: '<ISO8601 timestamp>' },
    };
    const { fake } = makeAnthropicFake(draftWithPlaceholder);
    const { voyage } = makeVoyageFake(false);
    const prisma = makePrisma([
      { id: 'ja:kana:a', display: 'あ', type: 'KANA', data: {} },
      { id: 'ja:kana:i', display: 'い', type: 'KANA', data: {} },
    ]);

    const result = await generateDraft(fake, voyage, prisma, TEST_LESSON, []);
    expect(result.draft.meta.generatedAt).not.toBe('<ISO8601 timestamp>');
    expect(
      new Date(result.draft.meta.generatedAt).getTime(),
    ).toBeLessThanOrEqual(Date.now());
  });

  it('includes corrections in the prompt when provided', async () => {
    const { fake, createFn } = makeAnthropicFake(MINIMAL_DRAFT);
    const { voyage } = makeVoyageFake(false);
    const prisma = makePrisma();
    const corrections = [
      {
        lesson_type: 'F-Kana',
        original_draft:
          MINIMAL_DRAFT as unknown as import('./lesson-schema').LessonDraft,
        notes: 'Mnemonic too weak.',
        regenerated_version: null,
        timestamp: new Date().toISOString(),
      },
    ];

    await generateDraft(fake, voyage, prisma, TEST_LESSON, corrections);

    const callBody = (
      createFn.mock.calls as Array<[{ messages: Array<{ content: string }> }]>
    )[0][0];
    expect(callBody.messages[0].content).toContain('Mnemonic too weak.');
  });
});

describe('generateCritique', () => {
  it('returns a validated critique with token counts', async () => {
    const { fake, createFn } = makeAnthropicFake(MINIMAL_CRITIQUE);
    const draft = LessonDraftSchema.parse(MINIMAL_DRAFT);

    const result = await generateCritique(fake, draft);

    expect(() => CritiqueSchema.parse(result.critique)).not.toThrow();
    expect(result.critique.lessonId).toBe('foundation-ja-ch01-l01');
    expect(result.inputTokens).toBe(200);
    expect(result.outputTokens).toBe(400);
    expect(createFn).toHaveBeenCalledTimes(1);
  });

  it('calls LLM with temperature:0 and haiku model', async () => {
    const { fake, createFn } = makeAnthropicFake(MINIMAL_CRITIQUE);
    const draft = LessonDraftSchema.parse(MINIMAL_DRAFT);

    await generateCritique(fake, draft);

    const callBody = (
      createFn.mock.calls as Array<[{ temperature: number; model: string }]>
    )[0][0];
    expect(callBody.temperature).toBe(0);
    expect(callBody.model).toBe(
      process.env['LLM_CRITIC_MODEL'] ?? 'claude-haiku-4-5-20251001',
    );
  });

  it('throws on non-JSON critic output', async () => {
    const createFn = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'I cannot process this.' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const fake: AnthropicLike = { messages: { create: createFn } };
    const draft = LessonDraftSchema.parse(MINIMAL_DRAFT);

    await expect(generateCritique(fake, draft)).rejects.toThrow(
      'non-JSON output',
    );
  });

  it('strips markdown fences from critique output', async () => {
    const fenced = `\`\`\`json\n${JSON.stringify(MINIMAL_CRITIQUE)}\n\`\`\``;
    const createFn = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: fenced }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const fake: AnthropicLike = { messages: { create: createFn } };
    const draft = LessonDraftSchema.parse(MINIMAL_DRAFT);

    const result = await generateCritique(fake, draft);
    expect(result.critique.lessonId).toBe('foundation-ja-ch01-l01');
  });
});
