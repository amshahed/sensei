import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { MasteryService } from '../mastery/mastery.service';
import { PrismaService } from '../prisma/prisma.service';
import type { PlacementQuestion } from './placement-questions';
import { PLACEMENT_RANDOM, PlacementService } from './placement.service';

const q = (itemId: string, chapterId: string): PlacementQuestion => ({
  itemId,
  chapterId,
  type: 'KANA',
  prompt: `Which hiragana is read “${itemId}”?`,
  display: null,
  parts: [{ label: null, choices: ['ok', 'x', 'y', 'z'], answer: 'ok' }],
});

describe('PlacementService', () => {
  let service: PlacementService;
  let attempt: Record<string, unknown> | null;
  let user: Record<string, unknown> | null;
  let updateMany: jest.Mock;
  let markCreateMany: jest.Mock;
  let lessonItemFindMany: jest.Mock;
  let attemptCreate: jest.Mock;
  let seedTested: jest.Mock;
  let seedInferred: jest.Mock;
  let tx: jest.Mock;

  beforeEach(async () => {
    user = { intakeCompletedAt: new Date(), priorExperience: 'FAIR_AMOUNT' };
    attempt = {
      id: 'pl-1',
      userId: 'u1',
      tier: 'FULL',
      status: 'IN_PROGRESS',
      questions: [q('a', 'c1'), q('b', 'c2'), q('c', 'c3'), q('d', 'c4')],
      answers: [],
      answered: 0,
      startChapterId: null,
    };
    // Compare-and-set on (status, answered), like the real updateMany.
    updateMany = jest.fn(
      ({
        where,
        data,
      }: {
        where: { status: string; answered?: number };
        data: Record<string, unknown>;
      }) => {
        if (
          !attempt ||
          attempt.status !== where.status ||
          (where.answered !== undefined && attempt.answered !== where.answered)
        ) {
          return Promise.resolve({ count: 0 });
        }
        attempt = { ...attempt, ...data };
        return Promise.resolve({ count: 1 });
      },
    );
    markCreateMany = jest.fn().mockResolvedValue({ count: 0 });
    // Skipped chapters' taught items: b2 untested + quizzable; g is a grammar shell.
    lessonItemFindMany = jest.fn().mockResolvedValue([
      {
        item: {
          id: 'a',
          type: 'KANA',
          display: 'a',
          reading: 'a',
          meaning: null,
          data: { romaji: 'a' },
        },
      },
      {
        item: {
          id: 'b2',
          type: 'KANA',
          display: 'b2',
          reading: 'b2',
          meaning: null,
          data: { romaji: 'b2' },
        },
      },
      {
        item: {
          id: 'g',
          type: 'GRAMMAR',
          display: 'g',
          reading: null,
          meaning: null,
          data: {},
        },
      },
    ]);
    attemptCreate = jest.fn();
    seedTested = jest.fn().mockResolvedValue(0);
    seedInferred = jest.fn().mockResolvedValue(0);

    const prisma: Record<string, unknown> = {
      user: { findUnique: () => Promise.resolve(user) },
      placementAttempt: {
        findUnique: () => Promise.resolve(attempt),
        findUniqueOrThrow: () => Promise.resolve(attempt),
        create: attemptCreate,
        updateMany,
      },
      chapter: {
        findMany: () =>
          Promise.resolve(['c1', 'c2', 'c3', 'c4', 'c5'].map((id) => ({ id }))),
        findUnique: ({ where: { id } }: { where: { id: string } }) =>
          Promise.resolve({ id, title: `Chapter ${id}` }),
      },
      userChapterMark: {
        createMany: markCreateMany,
        count: () => Promise.resolve(2),
      },
      lessonItem: { findMany: lessonItemFindMany },
      item: { findMany: () => Promise.resolve([]) },
    };
    tx = jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(prisma));
    prisma.$transaction = tx;

    const moduleRef = await Test.createTestingModule({
      providers: [
        PlacementService,
        { provide: PrismaService, useValue: prisma },
        { provide: MasteryService, useValue: { seedTested, seedInferred } },
        { provide: PLACEMENT_RANDOM, useValue: () => 0 },
      ],
    }).compile();
    service = moduleRef.get(PlacementService);
  });

  const answer = (itemId: string, choices: string[] | null = ['ok']) =>
    service.answer('u1', 'pl-1', { itemId, choices });

  it('a correct answer that is not the last just records it', async () => {
    expect(await answer('a')).toEqual({ done: false, result: null });
    expect(attempt).toMatchObject({
      answered: 1,
      answers: [{ itemId: 'a', correct: true }],
      status: 'IN_PROGRESS',
    });
    expect(tx).not.toHaveBeenCalled();
  });

  it('the first miss ends the quiz: earlier chapters skipped, evidence seeded, in one transaction', async () => {
    await answer('a');
    await answer('b');
    const res = await answer('c', ['x']);

    expect(res).toEqual({
      done: true,
      result: {
        status: 'COMPLETED',
        startChapter: { id: 'c3', title: 'Chapter c3' },
        skippedChapterCount: 2,
        answered: 3,
      },
    });
    expect(tx).toHaveBeenCalledTimes(1);
    expect(attempt).toMatchObject({
      status: 'COMPLETED',
      startChapterId: 'c3',
    });
    expect(markCreateMany).toHaveBeenCalledWith({
      data: [
        { userId: 'u1', chapterId: 'c1', kind: 'SKIPPED_VIA_PLACEMENT' },
        { userId: 'u1', chapterId: 'c2', kind: 'SKIPPED_VIA_PLACEMENT' },
      ],
      skipDuplicates: true,
    });
    // Tested-correct → high; untested quizzable items of skipped chapters → moderate.
    expect(seedTested).toHaveBeenCalledWith(
      'u1',
      ['a', 'b'],
      expect.any(Date),
      expect.anything(),
    );
    expect(seedInferred).toHaveBeenCalledWith(
      'u1',
      ['b2'],
      expect.any(Date),
      expect.anything(),
    );
    expect(lessonItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: 'TARGET', lesson: { chapterId: { in: ['c1', 'c2'] } } },
      }),
    );
  });

  it('"I don\'t know" is a miss', async () => {
    const res = await answer('a', null);
    expect(res.result?.startChapter?.id).toBe('c1');
    expect(markCreateMany).toHaveBeenCalledWith({
      data: [],
      skipDuplicates: true,
    });
  });

  it('all correct: starts after the last chapter reached', async () => {
    for (const id of ['a', 'b', 'c']) await answer(id);
    const res = await answer('d');
    expect(res.result?.startChapter?.id).toBe('c5');
  });

  it('a concurrent submit of the same question loses the compare-and-set (409)', async () => {
    // Another request advanced the attempt between our read and our write.
    updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(answer('a')).rejects.toBeInstanceOf(ConflictException);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pl-1', status: 'IN_PROGRESS', answered: 0 },
      }),
    );
  });

  it('a miss that loses the race applies nothing (rolled back with the claim)', async () => {
    updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(answer('a', null)).rejects.toBeInstanceOf(ConflictException);
    expect(markCreateMany).not.toHaveBeenCalled();
    expect(seedTested).not.toHaveBeenCalled();
  });

  it('rejects out-of-order answers, foreign choices and other learners', async () => {
    await expect(answer('b')).rejects.toBeInstanceOf(BadRequestException);
    await expect(answer('a', ['nope'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(answer('a', ['ok', 'x'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.answer('u2', 'pl-1', { itemId: 'a', choices: ['ok'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('skip is only before the first answer', async () => {
    await answer('a');
    await expect(service.skip('u1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('skip before answering starts at the first chapter, with no marks or seeds', async () => {
    const res = await service.skip('u1');
    expect(res).toMatchObject({
      status: 'SKIPPED',
      startChapter: { id: 'c1' },
      answered: 0,
    });
    expect(markCreateMany).not.toHaveBeenCalled();
    expect(seedTested).not.toHaveBeenCalled();
  });

  it('no survey, or a beginner: no placement', async () => {
    user = { intakeCompletedAt: null, priorExperience: null };
    await expect(service.start('u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    user = { intakeCompletedAt: new Date(), priorExperience: 'NONE' };
    await expect(service.start('u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('a start that loses the one-attempt race resumes the winner', async () => {
    const winner = attempt;
    attempt = null;
    attemptCreate.mockImplementation(() => {
      attempt = winner;
      return Promise.reject(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
    });
    lessonItemFindMany.mockResolvedValue([]);
    const res = await service.start('u1');
    expect(res.attemptId).toBe('pl-1');
    expect(res.questions).toHaveLength(4);
  });

  it('nothing askable published: placement completes at once, at the start', async () => {
    attempt = null;
    lessonItemFindMany.mockResolvedValue([]);
    attemptCreate.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        attempt = {
          id: 'pl-2',
          userId: 'u1',
          status: 'IN_PROGRESS',
          answers: [],
          answered: 0,
          ...data,
        };
        return Promise.resolve(attempt);
      },
    );
    const res = await service.start('u1');
    expect(res.questions).toEqual([]);
    expect(res.result).toMatchObject({
      status: 'COMPLETED',
      startChapter: { id: 'c1' },
      answered: 0,
    });
  });
});
