import { Test } from '@nestjs/testing';
import { MasteryService } from '../mastery/mastery.service';
import { PrismaService } from '../prisma/prisma.service';
import { isValidTimeZone } from '../streak/streak-rules';
import { StreakService } from '../streak/streak.service';
import { isReminderSettingsRequest } from './reminders.controller';
import { RemindersService } from './reminders.service';

const NOW = new Date('2026-11-04T12:00:00Z');

describe('RemindersService', () => {
  let service: RemindersService;
  let user: Record<string, unknown> | null;
  let completion: { lessonId: string } | null;
  let day: { done: boolean; reviewsAnswered: number } | null;
  let dueTimes: jest.Mock;
  let upsert: jest.Mock;
  let updateMany: jest.Mock;
  let dayFind: jest.Mock;

  beforeEach(async () => {
    user = {
      timezone: 'Asia/Tokyo',
      dailyTargetMinutes: 20,
      remindersOn: false,
      reminderMinute: 18 * 60,
      eveningReminder: true,
      quietStartMinute: 22 * 60,
      quietEndMinute: 8 * 60,
      remindersAskedAt: null,
    };
    completion = null;
    day = null;
    dueTimes = jest.fn().mockResolvedValue([]);
    upsert = jest.fn(({ update }: { update: Record<string, unknown> }) => {
      Object.assign(user!, update);
      return Promise.resolve(user);
    });
    updateMany = jest.fn().mockResolvedValue({ count: 1 });
    dayFind = jest.fn(() => Promise.resolve(day));
    const moduleRef = await Test.createTestingModule({
      providers: [
        RemindersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: () => Promise.resolve(user && { ...user }),
              upsert,
              updateMany,
            },
            lessonCompletion: { findFirst: () => Promise.resolve(completion) },
            studyDay: { findUnique: dayFind },
          },
        },
        { provide: MasteryService, useValue: { dueTimes } },
        {
          // Same contract as the streak's: store a valid, changed zone.
          provide: StreakService,
          useValue: {
            rememberTimeZone: (
              _u: string,
              stored: string | null,
              reported?: string,
            ) => {
              if (
                reported &&
                reported !== stored &&
                isValidTimeZone(reported)
              ) {
                user!.timezone = reported;
                return Promise.resolve(reported);
              }
              return Promise.resolve(stored);
            },
          },
        },
      ],
    }).compile();
    service = moduleRef.get(RemindersService);
  });

  describe('the one-time offer', () => {
    it('is made only after a first completed lesson', async () => {
      expect((await service.get('u1', 'UTC', NOW)).offer).toBe(false);
      completion = { lessonId: 'l1' };
      expect((await service.get('u1', 'UTC', NOW)).offer).toBe(true);
    });

    it('is not made again once answered, or while reminders are on', async () => {
      completion = { lessonId: 'l1' };
      user!.remindersAskedAt = NOW;
      expect((await service.get('u1', 'UTC', NOW)).offer).toBe(false);
      user!.remindersAskedAt = null;
      user!.remindersOn = true;
      expect((await service.get('u1', 'UTC', NOW)).offer).toBe(false);
    });

    it('"not now" records the answer only the first time', async () => {
      await service.dismissOffer('u1', 'UTC', NOW);
      expect(updateMany).toHaveBeenCalledWith({
        where: { id: 'u1', remindersAskedAt: null },
        data: { remindersAskedAt: NOW },
      });
    });
  });

  describe('the plan', () => {
    it('is empty while reminders are off, without touching the schedule', async () => {
      const res = await service.get('u1', 'UTC', NOW);
      expect(res.plan).toEqual([]);
      expect(dueTimes).not.toHaveBeenCalled();
    });

    it('stores the device timezone, then reads today’s row, the session cap and due times', async () => {
      user!.remindersOn = true;
      day = { done: false, reviewsAnswered: 0 };
      dueTimes.mockResolvedValue([new Date('2026-11-04T00:00:00Z')]);
      // 12:00Z is 08:00 in New York: today's 18:00 primary is still ahead.
      const res = await service.get('u1', 'America/New_York', NOW);
      expect(dayFind).toHaveBeenCalledWith({
        where: { userId_localDate: { userId: 'u1', localDate: '2026-11-04' } },
        select: { done: true, reviewsAnswered: true },
      });
      // Horizon: midnight 7 days on, New York time; one session's worth.
      expect(dueTimes).toHaveBeenCalledWith(
        'u1',
        new Date('2026-11-11T05:00:00Z'),
        15,
      );
      expect(res.plan[0]).toMatchObject({
        kind: 'primary',
        at: '2026-11-04T23:00:00.000Z',
        title: '1 item is starting to fade',
      });
      // Stored like a streak read: credits and this lookup share one day.
      expect(user!.timezone).toBe('America/New_York');
    });

    it('falls back to the stored timezone for a missing or bad one', async () => {
      user!.remindersOn = true;
      const res = await service.get('u1', 'Not/AZone', NOW);
      // Tokyo: 21:00 now, so tomorrow 18:00 JST comes first.
      expect(res.plan[0].at).toBe('2026-11-05T09:00:00.000Z');
    });

    it('a done day is suppressed; nothing due means the target copy', async () => {
      user!.remindersOn = true;
      day = { done: true, reviewsAnswered: 15 };
      const res = await service.get('u1', 'America/New_York', NOW);
      expect(res.plan[0]).toMatchObject({
        at: '2026-11-05T23:00:00.000Z',
        title: 'Today’s 20 minutes',
      });
    });
  });

  describe('what fires', () => {
    it('reports the reminders these settings actually fire', async () => {
      expect((await service.get('u1', 'UTC', NOW)).fires).toEqual({
        primary: true,
        lastCall: true,
      });
      user!.reminderMinute = 20 * 60; // under 2 h before the last call
      expect((await service.get('u1', 'UTC', NOW)).fires.lastCall).toBe(false);
      user!.reminderMinute = 8 * 60;
      user!.quietStartMinute = 21 * 60; // quiet from 21:00
      user!.quietEndMinute = 9 * 60; // ...until 09:00 swallows 08:00
      expect((await service.get('u1', 'UTC', NOW)).fires).toEqual({
        primary: false,
        lastCall: false,
      });
    });
  });

  describe('update', () => {
    it('maps the request onto the user and answers the offer', async () => {
      const res = await service.update(
        'u1',
        { on: true, minute: 8 * 60, evening: false },
        'UTC',
        NOW,
      );
      expect(upsert).toHaveBeenCalledWith({
        where: { id: 'u1' },
        update: {
          remindersOn: true,
          reminderMinute: 480,
          eveningReminder: false,
          remindersAskedAt: NOW,
        },
        create: {
          id: 'u1',
          remindersOn: true,
          reminderMinute: 480,
          eveningReminder: false,
          remindersAskedAt: NOW,
        },
      });
      expect(res.settings).toEqual({
        on: true,
        minute: 480,
        evening: false,
        quietStartMinute: 1320,
        quietEndMinute: 480,
      });
      expect(res.plan.length).toBeGreaterThan(0);
    });

    it('one tap off: the plan empties', async () => {
      user!.remindersOn = true;
      const res = await service.update('u1', { on: false }, 'UTC', NOW);
      expect(res.plan).toEqual([]);
      expect(res.settings.on).toBe(false);
    });
  });
});

describe('isReminderSettingsRequest', () => {
  it('accepts any well-typed, non-empty subset', () => {
    expect(isReminderSettingsRequest({ on: true })).toBe(true);
    expect(
      isReminderSettingsRequest({
        minute: 0,
        quietStartMinute: 1439,
        quietEndMinute: 480,
        evening: false,
      }),
    ).toBe(true);
  });

  it('rejects empty, unknown, mistyped or out-of-range fields', () => {
    for (const bad of [
      null,
      [],
      {},
      { on: 'yes' },
      { minute: 1440 },
      { minute: -1 },
      { minute: 600.5 },
      { quietEndMinute: '08:00' },
      { on: true, sound: 'loud' },
    ]) {
      expect(isReminderSettingsRequest(bad)).toBe(false);
    }
  });
});
