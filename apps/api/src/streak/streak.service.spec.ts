import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { MasteryService } from '../mastery/mastery.service';
import { PrismaService } from '../prisma/prisma.service';
import { StreakService } from './streak.service';

const NOW = new Date('2026-11-04T12:00:00Z');
const TODAY = '2026-11-04';

type Day = {
  userId: string;
  localDate: string;
  effortSeconds: number;
  reviewsAnswered: number;
  done: boolean;
  doneAt: Date | null;
  frozen: boolean;
  freezeEarned: boolean;
};
type Num = number | { increment?: number; decrement?: number };
const apply = (v: number, n: Num | undefined) =>
  n === undefined
    ? v
    : typeof n === 'number'
      ? n
      : v + (n.increment ?? 0) - (n.decrement ?? 0);

/** Just enough stateful Prisma for the streak's queries. */
function store() {
  const days = new Map<string, Day>();
  const user: Record<string, unknown> = {
    id: 'u1',
    timezone: null,
    dailyTargetMinutes: 10,
    streakFreezes: 0,
    targetSuggestionDismissedAt: null,
  };
  const key = (d: { localDate: string }) => d.localDate;
  const prisma: Record<string, unknown> = {
    $queryRaw: () => Promise.resolve([]),
    user: {
      findUnique: () => Promise.resolve({ ...user }),
      update: ({ data }: { data: Record<string, unknown> }) => {
        for (const [k, v] of Object.entries(data)) {
          user[k] =
            k === 'streakFreezes' ? apply(user[k] as number, v as Num) : v;
        }
        return Promise.resolve({ ...user });
      },
      upsert: ({ update }: { update: Record<string, unknown> }) => {
        Object.assign(user, update);
        return Promise.resolve({ ...user });
      },
      updateMany: ({
        where,
        data,
      }: {
        where: { streakFreezes?: { lt: number } };
        data: Record<string, unknown>;
      }) => {
        const bank = user.streakFreezes as number;
        if (where.streakFreezes && !(bank < where.streakFreezes.lt)) {
          return Promise.resolve({ count: 0 });
        }
        for (const [k, v] of Object.entries(data)) {
          user[k] =
            k === 'streakFreezes' ? apply(user[k] as number, v as Num) : v;
        }
        return Promise.resolve({ count: 1 });
      },
    },
    studyDay: {
      upsert: ({
        where: {
          userId_localDate: { localDate },
        },
        create,
        update,
      }: {
        where: { userId_localDate: { localDate: string } };
        create: Partial<Day> & { userId: string; localDate: string };
        update: Record<string, unknown>;
      }) => {
        const row = days.get(localDate);
        if (!row) {
          const fresh: Day = {
            effortSeconds: 0,
            reviewsAnswered: 0,
            done: false,
            doneAt: null,
            frozen: false,
            freezeEarned: false,
            ...create,
          };
          days.set(localDate, fresh);
          return Promise.resolve({ ...fresh });
        }
        const next = { ...row } as Record<string, unknown>;
        for (const [k, v] of Object.entries(update)) {
          next[k] =
            typeof row[k as keyof Day] === 'number'
              ? apply(row[k as keyof Day] as number, v as Num)
              : v;
        }
        days.set(localDate, next as Day);
        return Promise.resolve({ ...(next as Day) });
      },
      updateMany: ({
        where,
        data,
      }: {
        where: Partial<Day>;
        data: Partial<Day>;
      }) => {
        const row = where.localDate ? days.get(where.localDate) : undefined;
        if (
          !row ||
          Object.entries(where).some(
            ([k, v]) => k !== 'userId' && row[k as keyof Day] !== v,
          )
        ) {
          return Promise.resolve({ count: 0 });
        }
        days.set(key(row), { ...row, ...data });
        return Promise.resolve({ count: 1 });
      },
      findMany: ({
        where,
        take,
      }: {
        where: { localDate?: { lt: string } };
        take?: number;
      }) =>
        Promise.resolve(
          [...days.values()]
            .filter((d) => !where.localDate || d.localDate < where.localDate.lt)
            .sort((a, b) => b.localDate.localeCompare(a.localDate))
            .slice(0, take ?? Infinity),
        ),
    },
  };
  prisma.$transaction = (fn: (tx: unknown) => Promise<unknown>) => fn(prisma);
  return { prisma, days, user };
}

describe('StreakService', () => {
  let service: StreakService;
  let s: ReturnType<typeof store>;
  let due: jest.Mock;

  beforeEach(async () => {
    s = store();
    due = jest.fn().mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: s.prisma },
        {
          provide: MasteryService,
          useValue: {
            // `due` stands in for the due list; the service only counts it.
            dueCount: async (_u: string, _n: Date, limit: number) =>
              Math.min(((await due()) as unknown[]).length, limit),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(StreakService);
  });

  const answers = (count: number, review = false) =>
    service.record('u1', { kind: 'answers', count, review }, NOW);
  const lesson = (estimatedMinutes: number | null) =>
    service.record('u1', { kind: 'lesson', estimatedMinutes }, NOW);
  const today = () => s.days.get(TODAY)!;

  describe('record: is the day done?', () => {
    it('credits effort: a lesson its estimate (5 if none), an answer 20s', async () => {
      await lesson(6);
      await lesson(null);
      await answers(3);
      expect(today().effortSeconds).toBe(6 * 60 + 5 * 60 + 3 * 20);
    });

    it('nothing due: effort reaching the target completes the day', async () => {
      await lesson(6);
      expect(today().done).toBe(false);
      await lesson(5);
      expect(today()).toMatchObject({ done: true, doneAt: NOW });
    });

    it('reviews due: the target alone is not enough', async () => {
      due.mockResolvedValue(new Array(4).fill({}));
      await lesson(30);
      expect(today().done).toBe(false);
      // Clearing them (FSRS moves them off the due list) completes it.
      due.mockResolvedValue([]);
      await answers(4, true);
      expect(today().done).toBe(true);
    });

    it('a full review session clears a backlog for the day', async () => {
      due.mockResolvedValue(new Array(200).fill({}));
      await answers(15, true); // 5 min of reviews
      await lesson(5); // 10 min total
      expect(today().done).toBe(true);
    });

    it('practice cannot stand in for the review session (K.3.b)', async () => {
      due.mockResolvedValue(new Array(20).fill({}));
      await answers(60); // 20 min of practice, not reviews
      expect(today().done).toBe(false);
    });

    it('once done, a day stays done', async () => {
      await lesson(10);
      expect(today().done).toBe(true);
      due.mockResolvedValue(new Array(5).fill({}));
      expect((await service.status('u1', undefined, NOW)).today.done).toBe(
        true,
      );
    });

    it('two first credits of the day racing: the loser retries as an update', async () => {
      const studyDay = s.prisma.studyDay as {
        upsert: (a: unknown) => Promise<Day>;
      };
      const real = studyDay.upsert;
      let raced = false;
      studyDay.upsert = async (args) => {
        if (!raced) {
          raced = true;
          await real(args); // the other request's create wins...
          throw new Prisma.PrismaClientKnownRequestError('unique', {
            code: 'P2002',
            clientVersion: 'test',
          }); // ...and ours loses on the primary key
        }
        return real(args);
      };
      await lesson(4);
      expect(today().effortSeconds).toBe(2 * 4 * 60);
    });

    it('never throws: the learning action already happened', async () => {
      (s.prisma.studyDay as { upsert: unknown }).upsert = () =>
        Promise.reject(new Error('db down'));
      await expect(lesson(5)).resolves.toBeUndefined();
    });
  });

  describe('freezes (K.3.a)', () => {
    it('a done day at 2× target banks one freeze, once per day', async () => {
      await lesson(20); // 2× the 10-min target
      await lesson(20);
      expect(s.user.streakFreezes).toBe(1);
    });

    it('over-delivering without clearing reviews banks nothing', async () => {
      due.mockResolvedValue(new Array(3).fill({}));
      await lesson(30);
      expect(s.user.streakFreezes).toBe(0);
    });

    it('the bank is capped', async () => {
      s.user.streakFreezes = 2;
      await lesson(20);
      expect(s.user.streakFreezes).toBe(2);
    });

    it('covers a missed day automatically and keeps the streak', async () => {
      s.user.streakFreezes = 1;
      s.days.set('2026-11-02', {
        ...emptyDay('2026-11-02'),
        done: true,
      });
      const res = await service.status('u1', undefined, NOW);
      expect(s.days.get('2026-11-03')).toMatchObject({ frozen: true });
      expect(res).toMatchObject({ days: 2, freezes: 0, freezeCap: 2 });
    });

    it('activity on the day back fills the gap, even if Home is never opened', async () => {
      s.user.streakFreezes = 1;
      s.days.set('2026-11-02', { ...emptyDay('2026-11-02'), done: true });
      await lesson(10); // 11-04: back after missing 11-03, no status read
      expect(s.days.get('2026-11-03')).toMatchObject({ frozen: true });
      // Next day, the done 11-04 is the last covered day — the streak holds.
      const res = await service.status(
        'u1',
        undefined,
        new Date('2026-11-05T12:00:00Z'),
      );
      expect(res).toMatchObject({ days: 3, freezes: 0 });
    });

    it('no gap: the bank is read without taking the row lock', async () => {
      s.user.streakFreezes = 2;
      s.days.set('2026-11-03', { ...emptyDay('2026-11-03'), done: true });
      const tx = jest.spyOn(
        s.prisma as { $transaction: () => unknown },
        '$transaction',
      );
      const res = await service.status('u1', undefined, NOW);
      expect(tx).not.toHaveBeenCalled();
      expect(res.freezes).toBe(2);
    });

    it('a gap larger than the bank breaks the streak and keeps the bank', async () => {
      s.user.streakFreezes = 1;
      s.days.set('2026-11-01', { ...emptyDay('2026-11-01'), done: true });
      const res = await service.status('u1', undefined, NOW);
      expect(res).toMatchObject({ days: 0, freezes: 1 });
      expect(s.days.has('2026-11-02')).toBe(false);
    });
  });

  describe('status', () => {
    it('reports today’s effort, target and the reviews still needed', async () => {
      due.mockResolvedValue(new Array(30).fill({}));
      await answers(5, true);
      const res = await service.status('u1', undefined, NOW);
      expect(res.today).toEqual({
        done: false,
        effortMinutes: 1, // 100 s
        targetMinutes: 10,
        reviewsRemaining: 10, // a 15-review session, 5 done
      });
    });

    it('stores a valid timezone the app reports, and uses it for the day', async () => {
      await service.status(
        'u1',
        'Asia/Tokyo',
        new Date('2026-11-04T20:00:00Z'),
      );
      expect(s.user.timezone).toBe('Asia/Tokyo');
      await service.record(
        'u1',
        { kind: 'lesson', estimatedMinutes: 5 },
        new Date('2026-11-04T20:00:00Z'),
      );
      expect(s.days.has('2026-11-05')).toBe(true);
      await service.status('u1', 'Not/AZone', NOW);
      expect(s.user.timezone).toBe('Asia/Tokyo');
    });
  });

  describe('target (K.3.c)', () => {
    it('changing the target starts a quiet period for suggestions', async () => {
      const res = await service.setTarget('u1', 20, undefined, NOW);
      expect(s.user.dailyTargetMinutes).toBe(20);
      expect(s.user.targetSuggestionDismissedAt).toBeInstanceOf(Date);
      expect(res.today.targetMinutes).toBe(20);
    });

    it('lowering the target can complete today without new activity', async () => {
      await lesson(6);
      expect(today().done).toBe(false);
      const res = await service.setTarget('u1', 5, undefined, NOW);
      expect(res.today.done).toBe(true);
      expect(res.days).toBe(1);
    });

    it('a day finished by a lowered target still banks its freeze', async () => {
      s.user.dailyTargetMinutes = 20;
      await lesson(15); // 15 min against a 20-min target: not done
      expect(today().done).toBe(false);
      const res = await service.setTarget('u1', 5, undefined, NOW);
      expect(res.today.done).toBe(true);
      expect(today().freezeEarned).toBe(true);
      expect(res.freezes).toBe(1);
      expect(s.user.streakFreezes).toBe(1);
    });

    it('"not now" silences suggestions', async () => {
      await service.dismissSuggestion('u1', undefined, NOW);
      expect(s.user.targetSuggestionDismissedAt).toBeInstanceOf(Date);
    });
  });
});

function emptyDay(localDate: string): Day {
  return {
    userId: 'u1',
    localDate,
    effortSeconds: 600,
    reviewsAnswered: 0,
    done: false,
    doneAt: null,
    frozen: false,
    freezeEarned: false,
  };
}
