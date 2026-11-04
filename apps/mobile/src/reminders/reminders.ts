import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { RemindersDto } from '@sensei/types';
import { api, setActivityListener } from '../api';

/**
 * Reminders (K.3.d/K.3.g): the server builds the plan, this schedules it as
 * local notifications. Every sync replaces everything scheduled, so a day
 * that's done (dropped from the plan) goes quiet at the next sync — on open,
 * on leaving the app, and shortly after any learning activity.
 */

const CHANNEL = 'reminders';
/** Debounce after activity: a review session is many quick answers. */
const ACTIVITY_SYNC_DELAY_MS = 2_000;

/** Local notifications exist on iOS and Android only. */
export const remindersSupported =
  Platform.OS === 'ios' || Platform.OS === 'android';

// Device work runs one step at a time, so a cancel-all never lands
// mid-schedule.
let queue: Promise<void> = Promise.resolve();
const enqueue = (step: () => Promise<void>): Promise<void> => {
  const next = queue.then(step, step);
  queue = next.catch(() => undefined);
  return next;
};
// Last known on/off: activity syncs are skipped while reminders are off.
let lastOn = false;
// A sync already in flight is shared, not repeated (Home + app start).
let inFlight: Promise<RemindersDto | null> | null = null;
// Bumped by every local change (a settings save, Turn off, sign-out): a sync
// fetched before it is stale and must not reschedule the old settings.
let generation = 0;

/** Android 13+ needs a channel before it will show the permission prompt. */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Replace everything scheduled with `dto`'s plan (a fresh local change). */
export function applyPlan(dto: RemindersDto): Promise<void> {
  generation++;
  return schedule(dto);
}

function schedule(dto: RemindersDto): Promise<void> {
  lastOn = dto.settings.on;
  return enqueue(async () => {
    if (!remindersSupported) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!dto.settings.on || dto.plan.length === 0) return;
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    await ensureChannel();
    const now = Date.now();
    for (const r of dto.plan) {
      const date = new Date(r.at);
      if (date.getTime() <= now) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: r.title, body: r.body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
          channelId: CHANNEL,
        },
      });
    }
  });
}

/**
 * Cancel everything scheduled, on the device only — no network needed, so
 * "Turn off" and signing out take effect even offline.
 */
export function clearScheduled(): Promise<void> {
  generation++;
  lastOn = false;
  return enqueue(async () => {
    if (!remindersSupported) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
  });
}

/** Fetch the plan and schedule it. Best-effort: reminders never break the app. */
export function syncReminders(): Promise<RemindersDto | null> {
  if (!remindersSupported) return Promise.resolve(null);
  inFlight ??= (async () => {
    const gen = generation;
    try {
      const dto = await api.reminders();
      if (gen !== generation) return null; // settings changed meanwhile
      await schedule(dto);
      return dto;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Is the OS letting us notify? */
export async function notificationsAllowed(): Promise<boolean> {
  if (!remindersSupported) return false;
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Ask the OS — only ever after the learner taps "Turn on". */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Keep the schedule in step for a signed-in learner: sync now, on returning
 * to the app, shortly after learning activity, and — so a day finished just
 * before leaving goes quiet — straight away when the app is left with a sync
 * pending. Cleanup (sign-out) cancels everything scheduled for this account.
 */
export function startReminderSync(): () => void {
  if (!remindersSupported) return () => undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    void syncReminders();
  };
  setActivityListener(() => {
    if (!lastOn) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, ACTIVITY_SYNC_DELAY_MS);
  });
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') void syncReminders();
    else flush(); // 'inactive' / 'background': don't leave a done day ringing
  });
  void syncReminders();
  return () => {
    sub.remove();
    setActivityListener(null);
    if (timer) clearTimeout(timer);
    void clearScheduled();
  };
}

/** "18:00" for minutes after midnight. */
export function formatMinute(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
