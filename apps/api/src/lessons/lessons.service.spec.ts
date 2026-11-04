import { StreakService } from '../streak/streak.service';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { PrismaService } from '../prisma/prisma.service';

// Shaped like the Prisma payload the service queries (only fields the mapper reads).
const lessonFixture = {
  id: 'lesson-1',
  slug: 'the-five-vowels',
  title: 'The Five Vowels あいうえお',
  type: 'F_KANA',
  position: 1,
  estimatedMinutes: 5,
  teach: { blocks: [{ kind: 'heading', text: 'The Five Vowels' }] },
  chapter: {
    id: 'ch-1',
    title: 'Hiragana — Vowels',
    module: { id: 'mod-1', title: 'Foundation (Japanese)' },
  },
  items: [
    {
      role: 'TARGET',
      item: {
        id: 'ja:kana:a',
        language: 'ja',
        type: 'KANA',
        display: 'あ',
        reading: 'あ',
        meaning: null,
      },
    },
  ],
  checks: [
    {
      id: 'chk-1',
      position: 0,
      prompt: 'Which kana is read “a”?',
      format: 'MULTIPLE_CHOICE',
      targetItemId: 'ja:kana:a',
      data: { choices: ['あ', 'い', 'う'], answer: 'あ' },
    },
  ],
};

describe('LessonsService', () => {
  let service: LessonsService;
  let findFirst: jest.Mock;
  let userUpsert: jest.Mock;
  let completionCreateMany: jest.Mock;
  let completionFind: jest.Mock;
  let completionUpdate: jest.Mock;
  let streakRecord: jest.Mock;

  beforeEach(async () => {
    findFirst = jest.fn();
    userUpsert = jest.fn();
    completionCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const row = { completedAt: new Date('2026-06-12T00:00:00.000Z') };
    completionFind = jest.fn().mockResolvedValue(row);
    completionUpdate = jest.fn().mockResolvedValue(row);
    streakRecord = jest.fn().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        LessonsService,
        {
          provide: PrismaService,
          useValue: {
            lesson: { findFirst },
            user: { upsert: userUpsert },
            lessonCompletion: {
              createMany: completionCreateMany,
              findUniqueOrThrow: completionFind,
              update: completionUpdate,
            },
          },
        },
        { provide: StreakService, useValue: { record: streakRecord } },
      ],
    }).compile();
    service = moduleRef.get(LessonsService);
  });

  it('maps a lesson to a DTO and exposes choices', async () => {
    findFirst.mockResolvedValue(lessonFixture);

    const dto = await service.getByIdOrSlug('the-five-vowels');

    expect(dto.slug).toBe('the-five-vowels');
    expect(dto.type).toBe('F_KANA');
    expect(dto.module.title).toBe('Foundation (Japanese)');
    expect(dto.chapter.title).toBe('Hiragana — Vowels');
    expect(dto.items).toHaveLength(1);
    expect(dto.items[0]).toMatchObject({
      id: 'ja:kana:a',
      display: 'あ',
      role: 'TARGET',
    });
    expect(dto.checks[0].choices).toEqual(['あ', 'い', 'う']);
  });

  it('never leaks the correct answer to the client', async () => {
    findFirst.mockResolvedValue(lessonFixture);

    const dto = await service.getByIdOrSlug('the-five-vowels');

    expect(
      (dto.checks[0] as unknown as Record<string, unknown>).answer,
    ).toBeUndefined();
  });

  it('throws NotFound when the lesson does not exist', async () => {
    findFirst.mockResolvedValue(null);

    await expect(service.getByIdOrSlug('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('complete', () => {
    it('upserts the user then records the completion', async () => {
      findFirst.mockResolvedValue({ id: 'lesson-1', estimatedMinutes: 6 });

      const dto = await service.complete('the-five-vowels', 'dev-user');

      // User must be upserted before the completion (FK safety).
      expect(userUpsert).toHaveBeenCalledWith({
        where: { id: 'dev-user' },
        update: {},
        create: { id: 'dev-user' },
      });
      expect(completionCreateMany).toHaveBeenCalledWith({
        data: [{ userId: 'dev-user', lessonId: 'lesson-1' }],
        skipDuplicates: true,
      });
      // A first completion credits the lesson's minutes to the streak.
      expect(streakRecord).toHaveBeenCalledWith('dev-user', {
        kind: 'lesson',
        estimatedMinutes: 6,
      });
      expect(dto).toEqual({
        lessonId: 'lesson-1',
        completed: true,
        completedAt: '2026-06-12T00:00:00.000Z',
      });
    });

    it('re-completing refreshes the timestamp and credits no extra effort', async () => {
      findFirst.mockResolvedValue({ id: 'lesson-1', estimatedMinutes: 6 });
      completionCreateMany.mockResolvedValue({ count: 0 });

      const dto = await service.complete('the-five-vowels', 'dev-user');

      expect(completionUpdate).toHaveBeenCalledWith({
        where: {
          userId_lessonId: { userId: 'dev-user', lessonId: 'lesson-1' },
        },
        data: { completedAt: expect.any(Date) as Date },
      });
      expect(streakRecord).not.toHaveBeenCalled();
      expect(dto.completed).toBe(true);
    });

    it('throws NotFound completing a missing lesson', async () => {
      findFirst.mockResolvedValue(null);

      await expect(service.complete('nope', 'dev-user')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(userUpsert).not.toHaveBeenCalled();
    });
  });
});
