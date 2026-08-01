import { validateStructure } from './lesson-validator';
import { LessonDraftSchema, type LessonDraft } from './lesson-schema';
import { PrismaClient } from '@prisma/client';

function makeDraft(overrides: Partial<LessonDraft> = {}): LessonDraft {
  return LessonDraftSchema.parse({
    lessonId: 'foundation-ja-ch01-l01',
    lessonType: 'F-Kana',
    title: 'The Five Vowels',
    targetItemIds: ['ja:kana:a', 'ja:kana:i'],
    teach: {
      blocks: [
        { type: 'text', text: 'Intro. Learn the vowels.' },
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
          prompt: 'Sound?',
          answerType: 'multiple-choice',
          choices: ['a', 'i', 'u', 'e'],
          correctAnswer: 'a',
        },
      ],
    },
    meta: {
      generatedAt: new Date().toISOString(),
      model: 'claude-opus-4-8',
      tokenUsage: { inputTokens: 0, outputTokens: 0 },
    },
    ...overrides,
  });
}

function makePrisma(items: Array<{ id: string; type: string }>): PrismaClient {
  return {
    item: {
      findMany: jest.fn().mockResolvedValue(items),
    },
  } as unknown as PrismaClient;
}

describe('validateStructure', () => {
  it('passes a valid F-Kana draft with correct item types', async () => {
    const draft = makeDraft();
    const prisma = makePrisma([
      { id: 'ja:kana:a', type: 'KANA' },
      { id: 'ja:kana:i', type: 'KANA' },
    ]);
    const result = await validateStructure(draft, prisma);
    expect(result.pass).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when a targetItemId is missing from DB', async () => {
    const draft = makeDraft();
    const prisma = makePrisma([{ id: 'ja:kana:a', type: 'KANA' }]); // ja:kana:i missing
    const result = await validateStructure(draft, prisma);
    expect(result.pass).toBe(false);
    expect(result.errors.some((e) => e.includes('ja:kana:i'))).toBe(true);
  });

  it('fails when a check question references an undeclared targetItemId', async () => {
    const draft = makeDraft({
      check: {
        questions: [
          {
            id: 'q1',
            targetItemId: 'ja:kana:u', // not in targetItemIds
            prompt: 'Sound?',
            answerType: 'multiple-choice' as const,
            choices: ['u', 'a', 'i', 'e'],
            correctAnswer: 'u',
          },
        ],
      },
    });
    const prisma = makePrisma([
      { id: 'ja:kana:a', type: 'KANA' },
      { id: 'ja:kana:i', type: 'KANA' },
    ]);
    const result = await validateStructure(draft, prisma);
    expect(result.pass).toBe(false);
    expect(result.errors.some((e) => e.includes('ja:kana:u'))).toBe(true);
  });

  it('fails when F-Kana lesson has a non-KANA item', async () => {
    const draft = makeDraft();
    const prisma = makePrisma([
      { id: 'ja:kana:a', type: 'KANA' },
      { id: 'ja:kana:i', type: 'VOCAB' }, // wrong type
    ]);
    const result = await validateStructure(draft, prisma);
    expect(result.pass).toBe(false);
    expect(result.errors.some((e) => e.includes('VOCAB'))).toBe(true);
  });

  it('passes lesson-type adherence for I-* lessons regardless of item types', async () => {
    const draft = makeDraft({
      lessonType: 'I-Listening',
    });
    const prisma = makePrisma([
      { id: 'ja:kana:a', type: 'KANA' },
      { id: 'ja:kana:i', type: 'VOCAB' }, // mixed types ok for integration lessons
    ]);
    const result = await validateStructure(draft, prisma);
    // Item-ref validation still runs; only type-adherence check is skipped
    // Both IDs found → pass (assuming no other errors)
    expect(result.errors.some((e) => e.includes('VOCAB'))).toBe(false);
  });

  it('fails when audio src is an absolute URL', async () => {
    const draft = makeDraft({
      teach: {
        blocks: [
          { type: 'text' as const, text: 'Intro' },
          {
            type: 'audio' as const,
            src: 'https://cdn.example.com/audio/a.mp3', // absolute URL
            label: 'あ',
          },
        ],
      },
    });
    const prisma = makePrisma([
      { id: 'ja:kana:a', type: 'KANA' },
      { id: 'ja:kana:i', type: 'KANA' },
    ]);
    const result = await validateStructure(draft, prisma);
    expect(result.pass).toBe(false);
    expect(result.errors.some((e) => e.includes('audio'))).toBe(true);
  });

  it('passes audio src that is a relative placeholder path', async () => {
    const draft = makeDraft(); // already has 'audio/kana/a.mp3'
    const prisma = makePrisma([
      { id: 'ja:kana:a', type: 'KANA' },
      { id: 'ja:kana:i', type: 'KANA' },
    ]);
    const result = await validateStructure(draft, prisma);
    expect(result.pass).toBe(true);
  });

  it('fails when a practice template references an undeclared targetItemId', async () => {
    const draft = makeDraft({
      practice: {
        templates: [
          { targetItemId: 'ja:kana:u', mode: 'recognition' as const }, // not declared
        ],
      },
    });
    const prisma = makePrisma([
      { id: 'ja:kana:a', type: 'KANA' },
      { id: 'ja:kana:i', type: 'KANA' },
    ]);
    const result = await validateStructure(draft, prisma);
    expect(result.pass).toBe(false);
    expect(result.errors.some((e) => e.includes('practice'))).toBe(true);
  });
});
