import { Test } from '@nestjs/testing';
import type { Prisma } from '@prisma/client';
import { MasteryService } from './mastery.service';
import { PrismaService } from '../prisma/prisma.service';

const NOW = new Date('2026-06-13T00:00:00.000Z');

/** The persisted shape the service writes — enough of it for assertions. */
interface CreatePayload {
  fsrs: { due: string };
  recognition?: number;
  recall?: number;
  production?: number;
}
interface UpsertArg {
  create: CreatePayload;
  update: CreatePayload;
}

/** Typed accessor for the first upsert call's `create` payload. */
function firstCreate(mock: jest.Mock): CreatePayload {
  const calls = mock.mock.calls as UpsertArg[][];
  return calls[0][0].create;
}

describe('MasteryService', () => {
  let service: MasteryService;
  let userUpsert: jest.Mock;
  let stateFindUnique: jest.Mock;
  let stateUpsert: jest.Mock;
  let stateFindMany: jest.Mock;
  let stateCreateMany: jest.Mock;

  beforeEach(async () => {
    userUpsert = jest.fn().mockResolvedValue({});
    stateFindUnique = jest.fn();
    // Echo back the written fields so the returned DTO is inspectable.
    stateUpsert = jest
      .fn()
      .mockImplementation(
        (arg: {
          create?: Record<string, unknown>;
          update?: Record<string, unknown>;
        }) => ({
          userId: 'dev-user',
          itemId: 'ja:kana:a',
          recognition: 0,
          recall: 0,
          production: 0,
          ...(arg.create ?? arg.update),
        }),
      );
    stateFindMany = jest.fn();
    stateCreateMany = jest
      .fn()
      .mockImplementation((arg: { data: unknown[] }) => ({
        count: arg.data.length,
      }));

    const moduleRef = await Test.createTestingModule({
      providers: [
        MasteryService,
        {
          provide: PrismaService,
          useValue: {
            user: { upsert: userUpsert },
            itemMasteryState: {
              findUnique: stateFindUnique,
              upsert: stateUpsert,
              findMany: stateFindMany,
              createMany: stateCreateMany,
            },
          },
        },
      ],
    }).compile();
    service = moduleRef.get(MasteryService);
  });

  describe('recordCheckResult', () => {
    it('ensures the user exists before writing state', async () => {
      stateFindUnique.mockResolvedValue(null);

      await service.recordCheckResult({
        userId: 'dev-user',
        itemId: 'ja:kana:a',
        format: 'MULTIPLE_CHOICE',
        correct: true,
        reviewedAt: NOW,
      });

      expect(userUpsert).toHaveBeenCalledWith({
        where: { id: 'dev-user' },
        update: {},
        create: { id: 'dev-user' },
      });
    });

    it('creates fresh FSRS state on the first correct review', async () => {
      stateFindUnique.mockResolvedValue(null);

      const dto = await service.recordCheckResult({
        userId: 'dev-user',
        itemId: 'ja:kana:a',
        format: 'MULTIPLE_CHOICE',
        correct: true,
        reviewedAt: NOW,
      });

      expect(stateUpsert).toHaveBeenCalled();
      const create = firstCreate(stateUpsert);
      // First MULTIPLE_CHOICE pass bumps the recognition breadcrumb.
      expect(create.recognition).toBeCloseTo(0.4);
      expect(dto.mastery).toBeGreaterThan(0);
      expect(dto.retrievability).toBeCloseTo(1);
      expect(dto.due).not.toBeNull();
    });

    it('builds on existing FSRS state on a subsequent review', async () => {
      const first = await service.recordCheckResult({
        userId: 'dev-user',
        itemId: 'ja:kana:a',
        format: 'MULTIPLE_CHOICE',
        correct: true,
        reviewedAt: NOW,
      });
      const storedFsrs = firstCreate(stateUpsert).fsrs;

      stateFindUnique.mockResolvedValue({
        userId: 'dev-user',
        itemId: 'ja:kana:a',
        recognition: 0.4,
        recall: 0,
        production: 0,
        fsrs: storedFsrs,
        due: new Date(storedFsrs.due),
      });

      const tenDaysLater = new Date(NOW.getTime() + 1000 * 60 * 60 * 24 * 10);
      const second = await service.recordCheckResult({
        userId: 'dev-user',
        itemId: 'ja:kana:a',
        format: 'MULTIPLE_CHOICE',
        correct: true,
        reviewedAt: tenDaysLater,
      });

      // A second successful, spaced review should raise mastery (stability grows).
      expect(second.mastery).toBeGreaterThan(first.mastery);
    });

    it('updates the recall breadcrumb for a TYPED check', async () => {
      stateFindUnique.mockResolvedValue(null);

      await service.recordCheckResult({
        userId: 'dev-user',
        itemId: 'ja:vocab:neko',
        format: 'TYPED',
        correct: true,
        reviewedAt: NOW,
      });

      const create = firstCreate(stateUpsert);
      expect(create.recall).toBeCloseTo(0.4);
      expect(create.recognition).toBeUndefined();
    });
  });

  describe('getDue', () => {
    it('returns due items sorted by lowest retention first', async () => {
      // Build two real cards with different stabilities.
      const fresh = await service.recordCheckResult({
        userId: 'dev-user',
        itemId: 'ja:kana:a',
        format: 'MULTIPLE_CHOICE',
        correct: true,
        reviewedAt: NOW,
      });
      const cardA = firstCreate(stateUpsert).fsrs;
      void fresh;

      const past = new Date(NOW.getTime() - 1000 * 60 * 60 * 24 * 5);
      stateFindMany.mockResolvedValue([
        {
          itemId: 'ja:kana:a',
          mastery: 0.1,
          recognition: 0.4,
          recall: 0,
          production: 0,
          fsrs: cardA,
          due: past,
          item: {
            type: 'KANA',
            display: 'あ',
            reading: 'あ',
            meaning: null,
            data: { romaji: 'a' },
          },
        },
        {
          itemId: 'ja:kana:i',
          mastery: 0.9,
          recognition: 0.9,
          recall: 0.9,
          production: 0.9,
          fsrs: cardA,
          due: NOW,
          item: {
            type: 'KANA',
            display: 'い',
            reading: 'い',
            meaning: null,
            data: { romaji: 'i' },
          },
        },
      ]);

      const due = await service.getDue('dev-user', NOW);

      expect(due).toHaveLength(2);
      // Lowest retention first.
      expect(due[0].retrievability).toBeLessThanOrEqual(due[1].retrievability);
      expect(due[0].weakestModality).toBe('recall'); // 0 < recognition
      expect(due.map((d) => d.prompt)).toContain('Type the rōmaji for 「あ」');
    });

    it('keeps meaning-less grammar shells out of the query itself', async () => {
      stateFindMany.mockResolvedValue([]);
      await service.getDue('dev-user', NOW);
      const [[args]] = stateFindMany.mock.calls as [
        [{ where: Record<string, unknown> }],
      ];
      expect(args.where.NOT).toEqual({
        item: { type: 'GRAMMAR', meaning: null },
      });
    });

    it('skips due items with no quizzable question yet (e.g. a grammar shell)', async () => {
      stateFindMany.mockResolvedValue([
        {
          itemId: 'ja:grammar:です',
          mastery: 0,
          recognition: 0,
          recall: 0,
          production: 0,
          fsrs: {},
          due: NOW,
          item: {
            type: 'GRAMMAR',
            display: 'です',
            reading: null,
            meaning: null,
            data: {},
          },
        },
      ]);
      expect(await service.getDue('dev-user', NOW)).toEqual([]);
    });

    it('returns an empty queue when nothing is due', async () => {
      stateFindMany.mockResolvedValue([]);
      expect(await service.getDue('dev-user', NOW)).toEqual([]);
    });
  });

  describe('dueCount', () => {
    const kana = (n: number) => ({
      item: {
        type: 'KANA',
        display: 'あ',
        reading: 'あ',
        meaning: null,
        data: { romaji: `a${n}` },
      },
    });
    const shell = {
      item: {
        type: 'GRAMMAR',
        display: 'です',
        reading: null,
        meaning: null,
        data: {},
      },
    };

    it('counts only quizzable due items, with the same filter as getDue', async () => {
      stateFindMany.mockResolvedValueOnce([kana(1), shell, kana(2)]);
      expect(await service.dueCount('dev-user', NOW, 15)).toBe(2);
      const [[args]] = stateFindMany.mock.calls as [
        [{ where: Record<string, unknown> }],
      ];
      expect(args.where).toMatchObject({
        userId: 'dev-user',
        due: { lte: NOW },
        NOT: { item: { type: 'GRAMMAR', meaning: null } },
      });
    });

    it('stops paging once the limit is reached', async () => {
      const page = Array.from({ length: 50 }, (_, i) => kana(i));
      stateFindMany.mockResolvedValue(page);
      expect(await service.dueCount('dev-user', NOW, 15)).toBe(15);
      expect(stateFindMany).toHaveBeenCalledTimes(1);
    });

    it('pages past non-quizzable rows to find enough', async () => {
      stateFindMany
        .mockResolvedValueOnce(Array.from({ length: 50 }, () => shell))
        .mockResolvedValueOnce([kana(1)]);
      expect(await service.dueCount('dev-user', NOW, 15)).toBe(1);
      expect(stateFindMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('seedInferred (I.4.c tier 2 via a passed Assessment)', () => {
    it('seeds only items without state, at moderate (Hard) confidence', async () => {
      stateFindMany.mockResolvedValue([{ itemId: 'known' }]);
      const n = await service.seedInferred(
        'u1',
        ['known', 'new1', 'new2', 'new1'],
        NOW,
      );
      expect(n).toBe(2);
      const [[{ data, skipDuplicates }]] = stateCreateMany.mock.calls as [
        [
          {
            data: { itemId: string; mastery: number; due: Date }[];
            skipDuplicates: boolean;
          },
        ],
      ];
      expect(skipDuplicates).toBe(true);
      expect(data.map((d) => d.itemId)).toEqual(['new1', 'new2']);
      // Hard → shorter first interval than a Good review: confirmed early.
      const good = await service.recordCheckResult({
        userId: 'u1',
        itemId: 'x',
        format: 'TYPED',
        correct: true,
        reviewedAt: NOW,
      });
      expect(data[0].due.getTime()).toBeLessThanOrEqual(
        new Date(good.due!).getTime(),
      );
      expect(data[0].mastery).toBeLessThanOrEqual(good.mastery);
    });

    it('writes nothing when every item already has state (inference never overrides evidence)', async () => {
      stateFindMany.mockResolvedValue([{ itemId: 'a' }]);
      expect(await service.seedInferred('u1', ['a'], NOW)).toBe(0);
      expect(await service.seedInferred('u1', [], NOW)).toBe(0);
      expect(stateCreateMany).not.toHaveBeenCalled();
    });
  });

  describe('seedTested (I.4.c tier 1 via placement, I.4.f)', () => {
    it('seeds a Good first review with a recognition breadcrumb, later due than an inferred seed', async () => {
      stateFindMany.mockResolvedValue([{ itemId: 'known' }]);
      expect(await service.seedTested('u1', ['known', 't1'], NOW)).toBe(1);
      await service.seedInferred('u1', ['i1'], NOW);
      type Row = {
        itemId: string;
        due: Date;
        mastery: number;
        recognition?: number;
      };
      const [[tested], [inferred]] = stateCreateMany.mock.calls as [
        [{ data: Row[] }],
        [{ data: Row[] }],
      ];
      expect(tested.data.map((d) => d.itemId)).toEqual(['t1']);
      expect(tested.data[0].recognition).toBeGreaterThan(0);
      expect(inferred.data[0].recognition).toBeUndefined();
      // High retention (Good) outlasts moderate (Hard).
      expect(tested.data[0].due.getTime()).toBeGreaterThan(
        inferred.data[0].due.getTime(),
      );
      expect(tested.data[0].mastery).toBeGreaterThanOrEqual(
        inferred.data[0].mastery,
      );
    });

    it('runs on a caller-supplied transaction client', async () => {
      const txFindMany = jest.fn().mockResolvedValue([]);
      const txCreateMany = jest.fn().mockResolvedValue({ count: 1 });
      const tx = {
        itemMasteryState: { findMany: txFindMany, createMany: txCreateMany },
      } as unknown as Prisma.TransactionClient;
      await service.seedTested('u1', ['t1'], NOW, tx);
      expect(txCreateMany).toHaveBeenCalled();
      expect(stateCreateMany).not.toHaveBeenCalled();
    });
  });
});
