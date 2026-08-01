import { publishLesson } from './lesson-publisher';
import type { LessonDraft } from './lesson-schema';
import type { Skeleton } from './skeleton-schema';
import { PrismaClient } from '@prisma/client';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MINIMAL_DRAFT: LessonDraft = {
  lessonId: 'foundation-ja-ch01-l01',
  lessonType: 'F-Kana',
  title: 'The Five Vowels',
  targetItemIds: ['ja:kana:a', 'ja:kana:i'],
  teach: {
    blocks: [{ type: 'text', text: 'Vowels' }],
  },
  practice: {
    templates: [{ targetItemId: 'ja:kana:a', mode: 'recognition' }],
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
        explanation: 'あ = a',
      },
    ],
  },
  meta: {
    generatedAt: new Date().toISOString(),
    model: 'claude-opus-4-8',
    tokenUsage: { inputTokens: 200, outputTokens: 400 },
  },
};

const MINIMAL_SKELETON: Skeleton = {
  module: {
    id: 'foundation-ja',
    title: 'Foundation (Japanese)',
    language: 'ja',
    chapters: [
      {
        id: 'foundation-ja-ch01',
        title: 'Hiragana — Vowels',
        lessons: [
          {
            id: 'foundation-ja-ch01-l01',
            type: 'F-Kana',
            title: 'The Five Vowels',
            itemIds: ['ja:kana:a', 'ja:kana:i'],
            estimatedMinutes: 7,
          },
        ],
      },
    ],
  },
  generatedAt: new Date().toISOString(),
  model: 'claude-opus-4-8',
  tokenUsage: { inputTokens: 4000, outputTokens: 6000 },
};

// ── Prisma mock factory ───────────────────────────────────────────────────────

type MockPrisma = {
  lesson: { findUnique: jest.Mock; upsert: jest.Mock };
  module: { upsert: jest.Mock };
  chapter: { upsert: jest.Mock };
  lessonItem: { deleteMany: jest.Mock; createMany: jest.Mock };
  check: { deleteMany: jest.Mock; createMany: jest.Mock };
  $transaction: jest.Mock;
};

function makeMockPrisma(lessonExists = false): MockPrisma {
  const moduleUpsert = jest
    .fn()
    .mockResolvedValue({ id: 'mod-1', slug: 'foundation-ja' });
  const chapterUpsert = jest
    .fn()
    .mockResolvedValue({ id: 'ch-1', slug: 'foundation-ja-ch01' });
  const lessonFindUnique = jest
    .fn()
    .mockResolvedValue(
      lessonExists ? { id: 'lesson-1', slug: 'foundation-ja-ch01-l01' } : null,
    );
  const lessonUpsert = jest
    .fn()
    .mockResolvedValue({ id: 'lesson-1', slug: 'foundation-ja-ch01-l01' });
  const lessonItemDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
  const lessonItemCreateMany = jest.fn().mockResolvedValue({ count: 2 });
  const checkDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
  const checkCreateMany = jest.fn().mockResolvedValue({ count: 1 });

  const txMock: Omit<MockPrisma, '$transaction' | 'lesson'> & {
    lesson: { findUnique: jest.Mock; upsert: jest.Mock };
  } = {
    module: { upsert: moduleUpsert },
    chapter: { upsert: chapterUpsert },
    lesson: { findUnique: lessonFindUnique, upsert: lessonUpsert },
    lessonItem: {
      deleteMany: lessonItemDeleteMany,
      createMany: lessonItemCreateMany,
    },
    check: { deleteMany: checkDeleteMany, createMany: checkCreateMany },
  };

  const $transaction = jest
    .fn()
    .mockImplementation((cb: (tx: unknown) => unknown) => {
      return cb(txMock);
    });

  return {
    lesson: { findUnique: lessonFindUnique, upsert: lessonUpsert },
    module: { upsert: moduleUpsert },
    chapter: { upsert: chapterUpsert },
    lessonItem: {
      deleteMany: lessonItemDeleteMany,
      createMany: lessonItemCreateMany,
    },
    check: { deleteMany: checkDeleteMany, createMany: checkCreateMany },
    $transaction,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('publishLesson', () => {
  it('returns created=true when lesson is new', async () => {
    const mock = makeMockPrisma(false);
    const result = await publishLesson(
      MINIMAL_DRAFT,
      MINIMAL_SKELETON,
      mock as unknown as PrismaClient,
    );
    expect(result.created).toBe(true);
    expect(result.lessonSlug).toBe('foundation-ja-ch01-l01');
    expect(result.itemsLinked).toBe(2);
    expect(result.checksWritten).toBe(1);
  });

  it('returns created=false when lesson already exists', async () => {
    const mock = makeMockPrisma(true);
    const result = await publishLesson(
      MINIMAL_DRAFT,
      MINIMAL_SKELETON,
      mock as unknown as PrismaClient,
    );
    expect(result.created).toBe(false);
  });

  it('upserts module and chapter', async () => {
    const mock = makeMockPrisma();
    await publishLesson(
      MINIMAL_DRAFT,
      MINIMAL_SKELETON,
      mock as unknown as PrismaClient,
    );
    expect(mock.module.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'foundation-ja' } }),
    );
    expect(mock.chapter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'foundation-ja-ch01' } }),
    );
  });

  it('upserts lesson with correct type and teach content', async () => {
    const mock = makeMockPrisma();
    await publishLesson(
      MINIMAL_DRAFT,
      MINIMAL_SKELETON,
      mock as unknown as PrismaClient,
    );
    expect(mock.lesson.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: 'foundation-ja-ch01-l01' },
        create: expect.objectContaining({
          type: 'F_KANA',
          title: 'The Five Vowels',
        }) as unknown,
      }),
    );
  });

  it('deletes and re-creates LessonItem rows (idempotent)', async () => {
    const mock = makeMockPrisma();
    await publishLesson(
      MINIMAL_DRAFT,
      MINIMAL_SKELETON,
      mock as unknown as PrismaClient,
    );
    expect(mock.lessonItem.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { lessonId: 'lesson-1' } }),
    );
    expect(mock.lessonItem.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ itemId: 'ja:kana:a', role: 'TARGET' }),
        ]) as unknown,
      }),
    );
  });

  it('deletes and re-creates Check rows (idempotent)', async () => {
    const mock = makeMockPrisma();
    await publishLesson(
      MINIMAL_DRAFT,
      MINIMAL_SKELETON,
      mock as unknown as PrismaClient,
    );
    expect(mock.check.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { lessonId: 'lesson-1' } }),
    );
    expect(mock.check.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            prompt: 'What sound is あ?',
            format: 'MULTIPLE_CHOICE',
          }),
        ]) as unknown,
      }),
    );
  });

  it('maps check format typed → TYPED', async () => {
    const draftTyped: LessonDraft = {
      ...MINIMAL_DRAFT,
      check: {
        questions: [
          {
            id: 'q1',
            targetItemId: 'ja:kana:a',
            prompt: 'Type the reading.',
            answerType: 'typed',
            correctAnswer: 'a',
          },
        ],
      },
    };
    const mock = makeMockPrisma();
    await publishLesson(
      draftTyped,
      MINIMAL_SKELETON,
      mock as unknown as PrismaClient,
    );
    const createCall = (
      mock.check.createMany.mock.calls as Array<
        [{ data: Array<{ format: string }> }]
      >
    )[0][0];
    expect(createCall.data[0].format).toBe('TYPED');
  });

  it('throws when lesson not found in skeleton', async () => {
    const badDraft = { ...MINIMAL_DRAFT, lessonId: 'nonexistent-id' };
    const mock = makeMockPrisma();
    await expect(
      publishLesson(
        badDraft,
        MINIMAL_SKELETON,
        mock as unknown as PrismaClient,
      ),
    ).rejects.toThrow(/not found in skeleton/);
  });

  it('throws on unknown lesson type', async () => {
    const badDraft = {
      ...MINIMAL_DRAFT,
      lessonType: 'X-Unknown' as LessonDraft['lessonType'],
    };
    const badSkeleton: Skeleton = {
      ...MINIMAL_SKELETON,
      module: {
        ...MINIMAL_SKELETON.module,
        chapters: [
          {
            ...MINIMAL_SKELETON.module.chapters[0],
            lessons: [
              {
                ...MINIMAL_SKELETON.module.chapters[0].lessons[0],
                type: 'X-Unknown' as LessonDraft['lessonType'],
              },
            ],
          },
        ],
      },
    };
    const mock = makeMockPrisma();
    await expect(
      publishLesson(badDraft, badSkeleton, mock as unknown as PrismaClient),
    ).rejects.toThrow(/Unknown lesson type/);
  });

  it('includes check explanation in data when present', async () => {
    const mock = makeMockPrisma();
    await publishLesson(
      MINIMAL_DRAFT,
      MINIMAL_SKELETON,
      mock as unknown as PrismaClient,
    );
    const createCall = (
      mock.check.createMany.mock.calls as Array<
        [{ data: Array<{ data: { explanation?: string } }> }]
      >
    )[0][0];
    expect(createCall.data[0].data.explanation).toBe('あ = a');
  });
});
