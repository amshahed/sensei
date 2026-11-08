import {
  loadLessonItems,
  generateDraft,
  generateCritique,
  buildVectorQuery,
  buildDraftPrompt,
  buildCritiquePrompt,
  passagesFor,
} from './lesson-prompter';
import type { CourseContext } from './course-context';
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

const COURSE_CONTEXT: CourseContext = {
  lessonId: 'foundation-ja-ch04-l01',
  lessonType: 'F-Vocab',
  position: 15,
  totalLessons: 120,
  kana: ['か', 'ぎ'],
  longVowelsTaught: false,
  grammar: [{ id: 'ja:grammar:です', surface: 'です' }],
  words: ['かぎ'],
  kanji: [],
  targets: [{ id: 'ja:vocab:鍵', surface: 'かぎ' }],
  hasKanaTargets: false,
  kanaCards: [{ char: 'ぎ', romaji: 'gi' }],
  typedReading: true,
  authorNote: 'One rule on shapes already known.',
};
const VOCAB_LESSON: Lesson = {
  id: 'foundation-ja-ch04-l01',
  type: 'F-Vocab',
  title: 'Voiced sounds',
  itemIds: ['ja:vocab:鍵'],
  estimatedMinutes: 7,
};
const VOCAB_ITEM = {
  id: 'ja:vocab:鍵',
  display: '鍵',
  reading: 'かぎ',
  type: 'VOCAB',
  data: { senses: ['key'] },
};

describe('buildDraftPrompt with course context (F.2.a)', () => {
  const prompt = buildDraftPrompt(
    VOCAB_LESSON,
    [VOCAB_ITEM],
    [],
    [],
    COURSE_CONTEXT,
  );

  it('lists what the learner knows and the rules for using it', () => {
    expect(prompt).toContain('lesson 15 of 120');
    expect(prompt).toContain('KANA THE LEARNER CAN READ: か ぎ');
    expect(prompt).toContain('Long vowels: NOT taught yet');
    expect(prompt).toContain('GRAMMAR TAUGHT SO FAR: です');
    expect(prompt).toContain('WORDS THE LEARNER KNOWS: かぎ');
    expect(prompt).toContain('with a space between words');
    expect(prompt).toContain('Kanji appear only in F-Kanji lessons');
  });

  it('shows a target word in kana, never its kanji', () => {
    expect(prompt).toContain('ja:vocab:鍵(かぎ・key)');
    expect(prompt).not.toContain('鍵・');
  });

  it('carries the note, the kana cards and the typed-reading rule', () => {
    expect(prompt).toContain('AUTHOR NOTE: One rule on shapes already known.');
    expect(prompt).toContain('ぎ = gi');
    expect(prompt).toContain('TYPED READING');
  });

  it('is unchanged in shape with no context', () => {
    const plain = buildDraftPrompt(VOCAB_LESSON, [VOCAB_ITEM], [], []);
    expect(plain).not.toContain('COURSE CONTEXT');
    expect(plain).toContain('ja:vocab:鍵(鍵・かぎ・key)');
  });
});

describe('passagesFor', () => {
  it('drops a Tatoeba sentence that breaks the rules and keeps one that does not', () => {
    expect(
      passagesFor(
        [
          { text: '私', source: 'tatoeba' },
          { text: 'かぎ', source: 'tatoeba' },
          { text: 'さかな', source: 'tatoeba' },
        ],
        COURSE_CONTEXT,
      ),
    ).toEqual(['かぎ']);
  });

  it('keeps a grammar reference, marked as not to be copied', () => {
    const [kept] = passagesFor(
      [{ text: 'Explains 私は', source: 'grammar-ref' }],
      COURSE_CONTEXT,
    );
    expect(kept).toMatch(/^\(reference only, do not copy its Japanese\) /);
  });

  it('passes everything through with no context', () => {
    expect(passagesFor([{ text: '私', source: 'tatoeba' }])).toEqual(['私']);
  });
});

describe('buildCritiquePrompt with course context', () => {
  const draft = LessonDraftSchema.parse(MINIMAL_DRAFT);

  it('tells the critic what grammar is taught, and keeps 9 checks', () => {
    const prompt = buildCritiquePrompt(draft, COURSE_CONTEXT);
    expect(prompt).toContain('grammar taught so far: です');
    expect(CRITIQUE_CHECKLIST).toHaveLength(9);
  });

  it('adds nothing with no context', () => {
    expect(buildCritiquePrompt(draft)).not.toContain('grammar taught so far');
  });
});

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
  // Some tests pin the default model, so one exported in the shell mustn't leak in.
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env['LLM_AUTHORING_MODEL'];
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it('allows 8000 output tokens, so a long draft is not cut off and lost', async () => {
    const { fake, createFn } = makeAnthropicFake(MINIMAL_DRAFT);
    const { voyage } = makeVoyageFake(false);
    await generateDraft(fake, voyage, makePrisma(), TEST_LESSON, []);
    expect(createFn).toHaveBeenCalledWith(
      expect.objectContaining({ max_tokens: 8000 }),
    );
  });

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

  it('calls the configured model when one is set', async () => {
    process.env['LLM_AUTHORING_MODEL'] = 'test-authoring-model';
    const { fake, createFn } = makeAnthropicFake(MINIMAL_DRAFT);
    const { voyage } = makeVoyageFake(false);

    await generateDraft(fake, voyage, makePrisma(), TEST_LESSON, []);

    const callBody = (
      createFn.mock.calls as Array<[Record<string, unknown>]>
    )[0][0];
    expect(callBody.model).toBe('test-authoring-model');
  });

  it('calls the authoring model with no sampling params (Opus 4.8 rejects them)', async () => {
    const { fake, createFn } = makeAnthropicFake(MINIMAL_DRAFT);
    const { voyage } = makeVoyageFake(false);
    const prisma = makePrisma();

    await generateDraft(fake, voyage, prisma, TEST_LESSON, []);

    const callBody = (
      createFn.mock.calls as Array<[Record<string, unknown>]>
    )[0][0];
    expect(callBody).not.toHaveProperty('temperature');
    expect(callBody.model).toBe('claude-opus-4-8');
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
  // Some tests pin the default model, so one exported in the shell mustn't leak in.
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env['LLM_CRITIC_MODEL'];
  });
  afterEach(() => {
    process.env = { ...saved };
  });

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

  it('calls the configured critic when one is set', async () => {
    process.env['LLM_CRITIC_MODEL'] = 'test-critic-model';
    const { fake, createFn } = makeAnthropicFake(MINIMAL_CRITIQUE);

    await generateCritique(fake, LessonDraftSchema.parse(MINIMAL_DRAFT));

    const callBody = (
      createFn.mock.calls as Array<[Record<string, unknown>]>
    )[0][0];
    expect(callBody.model).toBe('test-critic-model');
  });

  it('calls the Haiku critic at temperature 0, so the gate is repeatable', async () => {
    const { fake, createFn } = makeAnthropicFake(MINIMAL_CRITIQUE);
    const draft = LessonDraftSchema.parse(MINIMAL_DRAFT);

    await generateCritique(fake, draft);

    const callBody = (
      createFn.mock.calls as Array<[Record<string, unknown>]>
    )[0][0];
    expect(callBody.temperature).toBe(0);
    expect(callBody.model).toBe('claude-haiku-4-5');
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

  it('takes the corrected verdict when the critic sends two', async () => {
    const stale = { ...MINIMAL_CRITIQUE, overallPass: true };
    const corrected = { ...MINIMAL_CRITIQUE, overallPass: false };
    const reply = [stale, corrected]
      .map((c) => `\`\`\`json\n${JSON.stringify(c)}\n\`\`\``)
      .join('\nCorrection:\n');
    const createFn = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: reply }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const fake: AnthropicLike = { messages: { create: createFn } };

    const { critique } = await generateCritique(
      fake,
      LessonDraftSchema.parse(MINIMAL_DRAFT),
    );

    expect(critique.overallPass).toBe(false);
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
