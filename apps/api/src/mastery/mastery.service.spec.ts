import { Test } from '@nestjs/testing';
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
          },
        },
      ]);

      const due = await service.getDue('dev-user', NOW);

      expect(due).toHaveLength(2);
      // Lowest retention first.
      expect(due[0].retrievability).toBeLessThanOrEqual(due[1].retrievability);
      expect(due[0].weakestModality).toBe('recall'); // 0 < recognition
    });

    it('returns an empty queue when nothing is due', async () => {
      stateFindMany.mockResolvedValue([]);
      expect(await service.getDue('dev-user', NOW)).toEqual([]);
    });
  });
});
