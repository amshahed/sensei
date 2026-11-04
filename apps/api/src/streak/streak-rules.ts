import type { DailyTargetMinutes, TargetSuggestionDto } from '@sensei/types';

/** Effort credited per review / practice / assessment answer (K.3.f). */
export const ANSWER_EFFORT_SECONDS = 20;
/** Credit for a lesson without an estimate. */
export const DEFAULT_LESSON_MINUTES = 5;
/** Freezes a learner can bank (K.3.a: "capped at a small number"). */
export const FREEZE_CAP = 2;
/** A day's effort at this multiple of the target banks a freeze. */
export const FREEZE_EARN_MULTIPLE = 2;
/** Recalibration (K.3.c): look-back, minimum active days, and quiet period. */
export const SUGGEST_WINDOW_DAYS = 14;
export const SUGGEST_MIN_ACTIVE_DAYS = 7;
export const SUGGEST_COOLDOWN_DAYS = 14;
/** Every allowed daily target — a Record so the compiler flags a missing or extra one. */
const TARGET_SET: Record<DailyTargetMinutes, true> = {
  5: true,
  10: true,
  20: true,
  30: true,
};
/** The daily-target options, ascending (K.3.c). */
export const DAILY_TARGETS = Object.keys(TARGET_SET)
  .map(Number)
  .sort((a, b) => a - b) as readonly DailyTargetMinutes[];
export const isDailyTarget = (v: unknown): v is DailyTargetMinutes =>
  DAILY_TARGETS.includes(v as DailyTargetMinutes);
export const DEFAULT_TARGET_MINUTES: DailyTargetMinutes = 10;

/** True if `tz` is an IANA timezone this runtime understands. */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The learner-local calendar date (YYYY-MM-DD) of `at`. */
export function localDate(at: Date, timeZone: string | null): string {
  const tz = timeZone && isValidTimeZone(timeZone) ? timeZone : 'UTC';
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** Calendar arithmetic on YYYY-MM-DD dates. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Dates strictly between `from` and `to` (both YYYY-MM-DD, from < to). */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = addDays(from, 1); d < to; d = addDays(d, 1)) out.push(d);
  return out;
}

export interface DayRow {
  localDate: string;
  effortSeconds: number;
  done: boolean;
  frozen: boolean;
}

/**
 * The learning streak: consecutive done-or-frozen days ending today — or
 * ending yesterday while today is still in play.
 */
export function streakLength(rows: DayRow[], today: string): number {
  const covered = new Set(
    rows.filter((r) => r.done || r.frozen).map((r) => r.localDate),
  );
  let day = covered.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (covered.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/**
 * Days a banked freeze would have to cover to keep the streak alive: every
 * day missed since the last covered one, before today. Empty when nothing
 * was missed or there's no streak to protect.
 */
export function missedDays(rows: DayRow[], today: string): string[] {
  const last = rows
    .filter((r) => (r.done || r.frozen) && r.localDate < today)
    .map((r) => r.localDate)
    .sort()
    .pop();
  return last ? datesBetween(last, today) : [];
}

/**
 * K.3.c: suggest the next target up or down on a sustained mismatch over the
 * last {@link SUGGEST_WINDOW_DAYS} days (today excluded). The learner decides.
 */
export function targetSuggestion(
  rows: DayRow[],
  today: string,
  targetMinutes: number,
  quietUntil: Date | null,
  now: Date,
): TargetSuggestionDto | null {
  if (quietUntil && now < quietUntil) return null;
  const from = addDays(today, -SUGGEST_WINDOW_DAYS);
  const active = rows.filter(
    (r) => r.localDate >= from && r.localDate < today && r.effortSeconds > 0,
  );
  if (active.length < SUGGEST_MIN_ACTIVE_DAYS) return null;
  const target = targetMinutes * 60;
  const share = (pred: (r: DayRow) => boolean) =>
    active.filter(pred).length / active.length;
  const idx = DAILY_TARGETS.indexOf(targetMinutes as DailyTargetMinutes);
  if (
    share((r) => r.effortSeconds >= FREEZE_EARN_MULTIPLE * target) >= 0.7 &&
    idx !== -1 &&
    idx < DAILY_TARGETS.length - 1
  ) {
    return { direction: 'up', targetMinutes: DAILY_TARGETS[idx + 1] };
  }
  if (share((r) => r.effortSeconds < target) >= 0.5 && idx > 0) {
    return { direction: 'down', targetMinutes: DAILY_TARGETS[idx - 1] };
  }
  return null;
}
