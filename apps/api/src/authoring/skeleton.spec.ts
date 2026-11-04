import {
  loadItemData,
  generateSkeleton,
  bySourceOrder,
} from './skeleton-prompter';
import { SkeletonSchema } from './skeleton-schema';
import type { AnthropicLike } from '../llm/anthropic-llm-client';
import { PrismaClient } from '@prisma/client';
import { authoringModel } from './authoring-llm';

const MINIMAL_SKELETON = {
  module: {
    id: 'foundation-ja',
    title: 'Foundation Japanese',
    language: 'ja',
    chapters: [
      {
        id: 'foundation-ja-ch01',
        title: 'Hiragana Vowels',
        lessons: [
          {
            id: 'foundation-ja-ch01-l01',
            type: 'F-Kana',
            title: 'The Five Vowels',
            itemIds: [
              'ja:kana:a',
              'ja:kana:i',
              'ja:kana:u',
              'ja:kana:e',
              'ja:kana:o',
            ],
            estimatedMinutes: 7,
          },
        ],
      },
    ],
  },
  generatedAt: new Date().toISOString(),
  model: 'claude-opus-4-8',
  tokenUsage: { inputTokens: 100, outputTokens: 200 },
};

function makeAnthropicFake(response: unknown): {
  fake: AnthropicLike;
  createFn: jest.Mock;
} {
  const createFn = jest.fn().mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify(response) }],
    usage: { input_tokens: 100, output_tokens: 200 },
  });
  const fake: AnthropicLike = { messages: { create: createFn } };
  return { fake, createFn };
}

describe('SkeletonSchema', () => {
  it('validates a well-formed skeleton', () => {
    expect(() => SkeletonSchema.parse(MINIMAL_SKELETON)).not.toThrow();
  });

  it('rejects missing required fields', () => {
    const bad = { ...MINIMAL_SKELETON, module: undefined };
    expect(() => SkeletonSchema.parse(bad)).toThrow();
  });

  it('rejects invalid lesson type', () => {
    const bad = {
      ...MINIMAL_SKELETON,
      module: {
        ...MINIMAL_SKELETON.module,
        chapters: [
          {
            ...MINIMAL_SKELETON.module.chapters[0],
            lessons: [
              {
                ...MINIMAL_SKELETON.module.chapters[0].lessons[0],
                type: 'invalid',
              },
            ],
          },
        ],
      },
    };
    expect(() => SkeletonSchema.parse(bad)).toThrow();
  });

  it('rejects estimatedMinutes outside 3-15 range', () => {
    const bad = {
      ...MINIMAL_SKELETON,
      module: {
        ...MINIMAL_SKELETON.module,
        chapters: [
          {
            ...MINIMAL_SKELETON.module.chapters[0],
            lessons: [
              {
                ...MINIMAL_SKELETON.module.chapters[0].lessons[0],
                estimatedMinutes: 2,
              },
            ],
          },
        ],
      },
    };
    expect(() => SkeletonSchema.parse(bad)).toThrow();
  });
});

describe('generateSkeleton', () => {
  it('calls the LLM and returns a validated skeleton', async () => {
    const { fake, createFn } = makeAnthropicFake(MINIMAL_SKELETON);
    const data = {
      kana: [{ id: 'ja:kana:a', display: 'あ', data: {} }],
      grammar: [],
      vocab: [],
      kanji: [],
    };

    const result = await generateSkeleton(fake, 'foundation-ja', data);

    expect(result.skeleton.module.id).toBe('foundation-ja');
    expect(result.skeleton.module.chapters).toHaveLength(1);
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(200);
    expect(createFn).toHaveBeenCalledTimes(1);
  });

  it('calls the authoring model with no sampling params (Opus 4.8 rejects them)', async () => {
    const createFn = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(MINIMAL_SKELETON) }],
      usage: { input_tokens: 50, output_tokens: 100 },
    });
    const fake: AnthropicLike = { messages: { create: createFn } };

    await generateSkeleton(fake, 'foundation-ja', {
      kana: [],
      grammar: [],
      vocab: [],
      kanji: [],
    });

    const callBody = (
      createFn.mock.calls as Array<[Record<string, unknown>]>
    )[0][0];
    expect(callBody).not.toHaveProperty('temperature');
    expect(callBody.model).toBe(authoringModel());
  });

  it('throws when LLM returns non-JSON', async () => {
    const { fake, createFn } = makeAnthropicFake(null);
    createFn.mockResolvedValue({
      content: [{ type: 'text', text: 'Sorry, I cannot do that.' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const data = { kana: [], grammar: [], vocab: [], kanji: [] };
    await expect(generateSkeleton(fake, 'foundation-ja', data)).rejects.toThrow(
      'non-JSON output',
    );
  });

  it('throws when LLM returns JSON that fails schema validation', async () => {
    const invalid = { ...MINIMAL_SKELETON, module: null };
    const { fake } = makeAnthropicFake(invalid);
    const data = { kana: [], grammar: [], vocab: [], kanji: [] };
    await expect(
      generateSkeleton(fake, 'foundation-ja', data),
    ).rejects.toThrow();
  });
});

describe('loadItemData', () => {
  it('queries all four item types from the DB', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { item: { findMany } } as unknown as PrismaClient;

    const result = await loadItemData(prisma);

    expect(findMany).toHaveBeenCalledTimes(4);
    expect(result.kana).toEqual([]);
    expect(result.grammar).toEqual([]);
    expect(result.vocab).toEqual([]);
    expect(result.kanji).toEqual([]);
  });

  it('passes correct type filters to each query', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { item: { findMany } } as unknown as PrismaClient;

    await loadItemData(prisma);

    const calls = findMany.mock.calls as Array<[{ where: { type: string } }]>;
    const types = calls.map((c) => c[0].where.type);
    expect(types).toContain('KANA');
    expect(types).toContain('GRAMMAR');
    expect(types).toContain('VOCAB');
    expect(types).toContain('KANJI');
  });

  it('limits vocab to N5 words (not the first N inserted)', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { item: { findMany } } as unknown as PrismaClient;

    await loadItemData(prisma);

    const vocabCall = (
      findMany.mock.calls as Array<
        [{ where: { type: string; data?: unknown }; take?: number }]
      >
    ).find((c) => c[0].where.type === 'VOCAB');
    expect(vocabCall?.[0].where.data).toEqual({
      path: ['jlpt'],
      equals: 'N5',
    });
    expect(vocabCall?.[0].take).toBeGreaterThanOrEqual(800);
  });

  it('returns grammar in Tanos source order, not id order', async () => {
    const grammar = [
      { id: 'ja:grammar:は', display: 'は', data: { source_order: 8 } },
      { id: 'ja:grammar:です', display: 'です', data: { source_order: 1 } },
      { id: 'ja:grammar:x', display: 'x', data: {} },
    ];
    const findMany = jest
      .fn()
      .mockImplementation(({ where }: { where: { type: string } }) =>
        Promise.resolve(where.type === 'GRAMMAR' ? grammar : []),
      );
    const prisma = { item: { findMany } } as unknown as PrismaClient;

    const result = await loadItemData(prisma);

    expect(result.grammar.map((g) => g.id)).toEqual([
      'ja:grammar:です',
      'ja:grammar:は',
      'ja:grammar:x', // no source_order → last
    ]);
  });
});

describe('bySourceOrder', () => {
  it('does not mutate its input', () => {
    const items = [
      { id: 'b', display: 'b', data: { source_order: 2 } },
      { id: 'a', display: 'a', data: { source_order: 1 } },
    ];
    const sorted = bySourceOrder(items);
    expect(sorted.map((i) => i.id)).toEqual(['a', 'b']);
    expect(items.map((i) => i.id)).toEqual(['b', 'a']);
  });
});
