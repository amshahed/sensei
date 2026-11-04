import {
  addDays,
  datesBetween,
  type DayRow,
  isValidTimeZone,
  localDate,
  missedDays,
  streakLength,
  targetSuggestion,
} from './streak-rules';

const day = (localDate: string, over: Partial<DayRow> = {}): DayRow => ({
  localDate,
  effortSeconds: 600,
  done: true,
  frozen: false,
  ...over,
});

describe('local dates', () => {
  it('uses the learner’s timezone for the calendar day', () => {
    const at = new Date('2026-11-04T23:30:00Z');
    expect(localDate(at, 'UTC')).toBe('2026-11-04');
    expect(localDate(at, 'Asia/Tokyo')).toBe('2026-11-05');
    expect(localDate(at, 'America/Los_Angeles')).toBe('2026-11-04');
  });

  it('falls back to UTC for a missing or unknown timezone', () => {
    const at = new Date('2026-11-04T23:30:00Z');
    expect(localDate(at, null)).toBe('2026-11-04');
    expect(localDate(at, 'Mars/Olympus')).toBe('2026-11-04');
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('Europe/Berlin')).toBe(true);
  });

  it('does calendar arithmetic across month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(datesBetween('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-31',
      '2026-11-01',
    ]);
    expect(datesBetween('2026-11-01', '2026-11-02')).toEqual([]);
  });
});

describe('streakLength', () => {
  const today = '2026-11-04';

  it('counts consecutive done-or-frozen days ending today', () => {
    const rows = [
      day('2026-11-04'),
      day('2026-11-03', { done: false, frozen: true }),
      day('2026-11-02'),
      day('2026-10-31'), // gap on 11-01 ends the run
    ];
    expect(streakLength(rows, today)).toBe(3);
  });

  it('while today is still open, the run ending yesterday stands', () => {
    const rows = [
      day('2026-11-04', { done: false }),
      day('2026-11-03'),
      day('2026-11-02'),
    ];
    expect(streakLength(rows, today)).toBe(2);
  });

  it('a missed yesterday means no streak', () => {
    expect(streakLength([day('2026-11-02')], today)).toBe(0);
    expect(streakLength([], today)).toBe(0);
  });
});

describe('missedDays', () => {
  const today = '2026-11-04';

  it('lists the days since the last covered one, before today', () => {
    expect(
      missedDays(
        [day('2026-11-03', { done: false }), day('2026-11-01')],
        today,
      ),
    ).toEqual(['2026-11-02', '2026-11-03']);
  });

  it('nothing missed when yesterday was covered, or there is no streak at all', () => {
    expect(missedDays([day('2026-11-03')], today)).toEqual([]);
    expect(missedDays([day('2026-11-03', { done: false })], today)).toEqual([]);
  });

  it('today never counts as missed', () => {
    expect(missedDays([day('2026-11-04'), day('2026-11-03')], today)).toEqual(
      [],
    );
  });
});

describe('targetSuggestion (K.3.c)', () => {
  const today = '2026-11-20';
  const now = new Date('2026-11-20T12:00:00Z');
  /** `n` active days in the window, with the given effort (minutes). */
  const days = (n: number, minutes: number) =>
    Array.from({ length: n }, (_, i) =>
      day(addDays(today, -1 - i), { effortSeconds: minutes * 60 }),
    );

  it('suggests the next target up after sustained over-delivery', () => {
    expect(targetSuggestion(days(8, 20), today, 10, null, now)).toEqual({
      direction: 'up',
      targetMinutes: 20,
    });
  });

  it('suggests the next target down after sustained under-delivery', () => {
    expect(targetSuggestion(days(8, 6), today, 20, null, now)).toEqual({
      direction: 'down',
      targetMinutes: 10,
    });
  });

  it('needs enough active days in the window', () => {
    expect(targetSuggestion(days(6, 20), today, 10, null, now)).toBeNull();
    // Days older than the 14-day window don't count.
    const old = Array.from({ length: 10 }, (_, i) =>
      day(addDays(today, -20 - i), { effortSeconds: 1200 }),
    );
    expect(targetSuggestion(old, today, 10, null, now)).toBeNull();
  });

  it('ignores today (still in play) and inactive days', () => {
    const rows = [
      day(today, { effortSeconds: 99999 }),
      ...days(6, 20),
      day(addDays(today, -9), { effortSeconds: 0, done: false }),
    ];
    expect(targetSuggestion(rows, today, 10, null, now)).toBeNull();
  });

  it('stays quiet during a cooldown, and at the ends of the scale', () => {
    expect(
      targetSuggestion(days(8, 20), today, 10, new Date('2026-11-25'), now),
    ).toBeNull();
    expect(targetSuggestion(days(8, 90), today, 30, null, now)).toBeNull();
    expect(targetSuggestion(days(8, 1), today, 5, null, now)).toBeNull();
  });

  it('a calibrated learner gets no suggestion', () => {
    expect(targetSuggestion(days(10, 12), today, 10, null, now)).toBeNull();
  });
});
