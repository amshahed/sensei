import type { PlannedReminderDto, ReminderSettingsDto } from '@sensei/types';
import {
  addDays,
  ANSWER_EFFORT_SECONDS,
  isValidTimeZone,
} from '../streak/streak-rules';

/** How many days of reminders the phone holds at once (K.3.g). */
export const PLAN_DAYS = 7;
/** The evening last call (K.3.d): 21:00 local. */
export const LAST_CALL_MINUTE = 21 * 60;
/** Closer than this to the primary, a last call would just repeat it. */
export const LAST_CALL_MIN_GAP_MINUTES = 120;
export const MINUTES_PER_DAY = 24 * 60;

/** Defaults for a learner who hasn't changed anything (mirrors the schema). */
export const DEFAULT_REMINDER_SETTINGS: ReminderSettingsDto = {
  on: false,
  minute: 18 * 60,
  evening: true,
  quietStartMinute: 22 * 60,
  quietEndMinute: 8 * 60,
};

/** A whole minute of the day: 0 (midnight) to 1439 (23:59). */
export const isMinuteOfDay = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < MINUTES_PER_DAY;

/** Minutes `tz` is ahead of UTC at `at` (negative = behind). */
function offsetMinutes(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
  );
  const minuteStart = Math.floor(at.getTime() / 60_000) * 60_000;
  return Math.round((wall - minuteStart) / 60_000);
}

/**
 * The instant at `minute` after midnight on `localDate` (YYYY-MM-DD) in `tz`
 * (UTC when unknown). Corrected once for the offset at the result, so a DST
 * change between midnight and the target time is handled.
 */
export function zonedInstant(
  localDate: string,
  minute: number,
  tz: string | null,
): Date {
  const [y, m, d] = localDate.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, minute);
  if (!tz || !isValidTimeZone(tz)) return new Date(wall);
  const first = wall - offsetMinutes(new Date(wall), tz) * 60_000;
  return new Date(wall - offsetMinutes(new Date(first), tz) * 60_000);
}

/** Is `minute` inside the quiet window? Start = end means no quiet hours. */
export function inQuietHours(
  minute: number,
  start: number,
  end: number,
): boolean {
  if (start === end) return false;
  return start < end
    ? minute >= start && minute < end
    : minute >= start || minute < end; // wraps midnight, e.g. 22:00–08:00
}

type Slot = { kind: PlannedReminderDto['kind']; minute: number };

/**
 * The reminders these settings actually fire each day: the primary at the
 * learner's time, and the 21:00 last call when it's on and at least
 * {@link LAST_CALL_MIN_GAP_MINUTES} after the primary — minus anything in
 * quiet hours. One rule for the plan and for what the app tells the learner.
 */
export function firingSlots(settings: ReminderSettingsDto): Slot[] {
  const slots: Slot[] = [{ kind: 'primary', minute: settings.minute }];
  if (
    settings.evening &&
    LAST_CALL_MINUTE - settings.minute >= LAST_CALL_MIN_GAP_MINUTES
  ) {
    slots.push({ kind: 'lastCall', minute: LAST_CALL_MINUTE });
  }
  return slots.filter(
    ({ minute }) =>
      !inQuietHours(minute, settings.quietStartMinute, settings.quietEndMinute),
  );
}

export interface PlanInput {
  settings: ReminderSettingsDto;
  timeZone: string | null;
  now: Date;
  /** The learner's local date at `now`. */
  today: string;
  /** Today is done: nothing more fires today (K.3.d smart suppression). */
  todayDone: boolean;
  /** Reviews answered today, against the session cap. */
  reviewsAnsweredToday: number;
  /** Size of a review session (G.4). */
  sessionCap: number;
  targetMinutes: number;
  /** Due instants of quizzable items, ascending (the first `sessionCap` suffice). */
  dueTimes: Date[];
}

/**
 * The next {@link PLAN_DAYS} days of reminders (K.3.d/K.3.g): a primary at
 * the learner's time and, on a day that isn't done, a 21:00 last call —
 * at most 2 a day, none on a done day, none in quiet hours, none in the past.
 */
export function buildPlan(input: PlanInput): PlannedReminderDto[] {
  const { settings, now } = input;
  if (!settings.on) return [];
  const slots = firingSlots(settings);

  const plan: PlannedReminderDto[] = [];
  for (let k = 0; k < PLAN_DAYS; k++) {
    if (k === 0 && input.todayDone) continue;
    const date = addDays(input.today, k);
    const sessionLeft =
      k === 0
        ? Math.max(0, input.sessionCap - input.reviewsAnsweredToday)
        : input.sessionCap;
    for (const { kind, minute } of slots) {
      const at = zonedInstant(date, minute, input.timeZone);
      if (at <= now) continue;
      const due = Math.min(
        input.dueTimes.filter((t) => t <= at).length,
        sessionLeft,
      );
      plan.push({
        at: at.toISOString(),
        kind,
        ...reminderCopy(kind, due, input.targetMinutes),
      });
    }
  }
  return plan;
}

/**
 * Decay-honest copy (K.2 #3, K.3.d): what's fading and how long a review
 * takes, or today's target when nothing is due. Never streak-loss guilt.
 */
export function reminderCopy(
  kind: PlannedReminderDto['kind'],
  due: number,
  targetMinutes: number,
): { title: string; body: string } {
  const minutes = Math.max(1, Math.ceil((due * ANSWER_EFFORT_SECONDS) / 60));
  const one = due === 1;
  if (kind === 'primary') {
    return due > 0
      ? {
          title: `${due} ${one ? 'item is' : 'items are'} starting to fade`,
          body: `A quick review now keeps ${one ? 'it' : 'them'} fresh — about ${minutes} min.`,
        }
      : {
          title: `Today’s ${targetMinutes} minutes`,
          body: 'Pick up where you left off.',
        };
  }
  return due > 0
    ? {
        title: 'Still time today',
        body: `${due} ${one ? 'review is' : 'reviews are'} waiting — about ${minutes} min before the day resets.`,
      }
    : {
        title: 'Still time today',
        body: `A short session before midnight finishes today’s ${targetMinutes} minutes.`,
      };
}
