import type { PlannedReminderDto, ReminderSettingsDto } from '@sensei/types';
import {
  buildPlan,
  DEFAULT_REMINDER_SETTINGS,
  inQuietHours,
  type PlanInput,
  reminderCopy,
  zonedInstant,
} from './reminder-rules';

const NOW = new Date('2026-11-04T12:00:00Z');
const at = (iso: string) => new Date(iso);

function plan(
  settings: Partial<ReminderSettingsDto> = {},
  input: Partial<PlanInput> = {},
): PlannedReminderDto[] {
  return buildPlan({
    settings: { ...DEFAULT_REMINDER_SETTINGS, on: true, ...settings },
    timeZone: 'UTC',
    now: NOW,
    today: '2026-11-04',
    todayDone: false,
    reviewsAnsweredToday: 0,
    sessionCap: 15,
    targetMinutes: 10,
    dueTimes: [],
    ...input,
  });
}

describe('zonedInstant', () => {
  it('turns a local wall time into the instant it happens', () => {
    expect(zonedInstant('2026-11-04', 18 * 60, 'Asia/Tokyo')).toEqual(
      at('2026-11-04T09:00:00Z'),
    );
    expect(zonedInstant('2026-11-04', 8 * 60, 'Asia/Kolkata')).toEqual(
      at('2026-11-04T02:30:00Z'),
    );
  });

  it('follows daylight saving on either side of a change', () => {
    // New York: EDT (UTC−4) until 2026-11-01 02:00, EST (UTC−5) after.
    expect(zonedInstant('2026-10-31', 18 * 60, 'America/New_York')).toEqual(
      at('2026-10-31T22:00:00Z'),
    );
    expect(zonedInstant('2026-11-01', 18 * 60, 'America/New_York')).toEqual(
      at('2026-11-01T23:00:00Z'),
    );
  });

  it('falls back to UTC with no (or an unknown) timezone', () => {
    expect(zonedInstant('2026-11-04', 18 * 60, null)).toEqual(
      at('2026-11-04T18:00:00Z'),
    );
    expect(zonedInstant('2026-11-04', 18 * 60, 'Not/AZone')).toEqual(
      at('2026-11-04T18:00:00Z'),
    );
  });
});

describe('inQuietHours', () => {
  it('handles a window that wraps midnight, start inclusive and end exclusive', () => {
    expect(inQuietHours(22 * 60, 22 * 60, 8 * 60)).toBe(true);
    expect(inQuietHours(3 * 60, 22 * 60, 8 * 60)).toBe(true);
    expect(inQuietHours(8 * 60, 22 * 60, 8 * 60)).toBe(false);
    expect(inQuietHours(21 * 60, 22 * 60, 8 * 60)).toBe(false);
  });

  it('handles a same-day window, and start = end means none', () => {
    expect(inQuietHours(13 * 60, 12 * 60, 14 * 60)).toBe(true);
    expect(inQuietHours(15 * 60, 12 * 60, 14 * 60)).toBe(false);
    expect(inQuietHours(0, 0, 0)).toBe(false);
  });
});

describe('buildPlan (K.3.d / K.3.g)', () => {
  it('off: nothing is scheduled', () => {
    expect(plan({ on: false })).toEqual([]);
  });

  it('a primary at the chosen time and a 21:00 last call, for 7 days', () => {
    const p = plan();
    expect(p).toHaveLength(14);
    expect(p.slice(0, 2).map((r) => [r.kind, r.at])).toEqual([
      ['primary', '2026-11-04T18:00:00.000Z'],
      ['lastCall', '2026-11-04T21:00:00.000Z'],
    ]);
    expect(p.at(-1)?.at).toBe('2026-11-10T21:00:00.000Z');
  });

  it('never more than 2 on any local day', () => {
    const perDay = new Map<string, number>();
    for (const r of plan()) {
      const d = r.at.slice(0, 10);
      perDay.set(d, (perDay.get(d) ?? 0) + 1);
    }
    expect(Math.max(...perDay.values())).toBe(2);
  });

  it('a done day gets nothing; the plan resumes tomorrow', () => {
    const p = plan({}, { todayDone: true });
    expect(p).toHaveLength(12);
    expect(p[0].at).toBe('2026-11-05T18:00:00.000Z');
  });

  it('skips times already past today', () => {
    const p = plan({}, { now: at('2026-11-04T19:00:00Z') });
    expect(p[0]).toMatchObject({
      kind: 'lastCall',
      at: '2026-11-04T21:00:00.000Z',
    });
  });

  it('no last call when the primary is under 2 hours before it, or when it is turned off', () => {
    expect(plan({ minute: 20 * 60 }).every((r) => r.kind === 'primary')).toBe(
      true,
    );
    expect(plan({ minute: 19 * 60 }).some((r) => r.kind === 'lastCall')).toBe(
      true,
    );
    expect(plan({ evening: false }).every((r) => r.kind === 'primary')).toBe(
      true,
    );
  });

  it('drops anything inside quiet hours', () => {
    // 07:00 primary falls in the default 22:00–08:00 window.
    expect(plan({ minute: 7 * 60 }).every((r) => r.kind === 'lastCall')).toBe(
      true,
    );
    // A window from 20:00 swallows the last call.
    expect(
      plan({ quietStartMinute: 20 * 60 }).every((r) => r.kind === 'primary'),
    ).toBe(true);
  });

  it('uses the learner’s timezone for every day', () => {
    const p = plan(
      {},
      { timeZone: 'Asia/Tokyo', today: '2026-11-04', now: NOW },
    );
    // 12:00Z is 21:00 in Tokyo: today's 18:00 has passed, the last call
    // is right now (not after it), so tomorrow 18:00 JST comes first.
    expect(p[0].at).toBe('2026-11-05T09:00:00.000Z');
  });

  it('counts the items due by each reminder, capped at what is left of the session', () => {
    const dueTimes = [
      at('2026-11-04T10:00:00Z'),
      at('2026-11-04T20:00:00Z'),
      at('2026-11-05T10:00:00Z'),
    ];
    const p = plan({}, { dueTimes });
    expect(p[0].title).toBe('1 item is starting to fade');
    expect(p[1].body).toMatch(/^2 reviews are waiting/);
    expect(p[2].title).toBe('3 items are starting to fade');

    // 14 of a 15-review session answered today: only 1 left today.
    const capped = plan({}, { dueTimes, reviewsAnsweredToday: 14 });
    expect(capped[1].body).toMatch(/^1 review is waiting/);
    expect(capped[2].title).toBe('3 items are starting to fade');
  });

  it('nothing due: the reminder is about the day’s target', () => {
    expect(plan()[0]).toMatchObject({
      title: 'Today’s 10 minutes',
      body: 'Pick up where you left off.',
    });
  });
});

describe('reminderCopy', () => {
  it('is decay-honest: never streak-loss guilt', () => {
    const all = [0, 1, 7].flatMap((n) =>
      (['primary', 'lastCall'] as const).map((k) => reminderCopy(k, n, 10)),
    );
    for (const { title, body } of all) {
      expect(`${title} ${body}`).not.toMatch(
        /streak|lose|lost|miss|break|don['’]t/i,
      );
    }
  });

  it('estimates minutes at 20 s per review, at least 1', () => {
    expect(reminderCopy('primary', 1, 10).body).toMatch(/about 1 min/);
    expect(reminderCopy('primary', 15, 10).body).toMatch(/about 5 min/);
  });
});
