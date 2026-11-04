import type { DailyTargetMinutes } from '@sensei/types';

/** Label per daily target — a Record so the compiler flags a missing or extra one. */
const LABELS: Record<DailyTargetMinutes, string> = {
  5: '5 min',
  10: '10 min',
  20: '20 min',
  30: '30+ min',
};

/** The daily-target options (K.3.c), ascending — shared by signup and the streak card. */
export const DAILY_TARGET_OPTIONS: { id: DailyTargetMinutes; label: string }[] =
  (Object.keys(LABELS).map(Number) as DailyTargetMinutes[])
    .sort((a, b) => a - b)
    .map((id) => ({ id, label: LABELS[id] }));
