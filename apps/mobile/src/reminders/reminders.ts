import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { RemindersDto } from '@sensei/types';
import { api, setActivityListener } from '../api';

/**
 * Reminders (K.3.d/K.3.g): the server builds the plan, this schedules it as
 * local notifications. Every sync replaces everything scheduled, so a day
 * that's done (dropped from the plan) goes quiet at the next sync — on open,
 * and shortly after any learning activity.
 */

const CHANNEL = 'reminders';
/** Debounce after activity: a review session is many quick answers. */
const ACTIVITY_SYNC_DELAY_MS = 2_000;

/** Local notifications exist on iOS and Android only. */
export const remindersSupported =
  Platform.OS === 'ios' || Platform.OS === 'android';

// Syncs run one at a time, so a cancel-all never lands mid-schedule.
let queue: Promise<void> = Promise.resolve();
// Last known on/off: activity syncs are skipped while reminders are off.
let lastOn = false;

/** Replace everything scheduled with `dto`'s plan. */
export function applyPlan(dto: RemindersDto): Promise<void> {
  lastOn = dto.settings.on;
  const run = async () => {
    if (!remindersSupported) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!dto.settings.on || dto.plan.length === 0) return;
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
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
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

/** Fetch the plan and schedule it. Best-effort: reminders never break the app. */
export async function syncReminders(): Promise<RemindersDto | null> {
  if (!remindersSupported) return null;
  try {
    const dto = await api.reminders();
    await applyPlan(dto);
    return dto;
  } catch {
    return null;
  }
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
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Keep the schedule in step: sync now, whenever the app comes to the
 * foreground, and shortly after learning activity. Returns a cleanup.
 */
export function startReminderSync(): () => void {
  if (!remindersSupported) return () => undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;
  setActivityListener(() => {
    if (!lastOn) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void syncReminders();
    }, ACTIVITY_SYNC_DELAY_MS);
  });
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') void syncReminders();
  });
  void syncReminders();
  return () => {
    sub.remove();
    setActivityListener(null);
    if (timer) clearTimeout(timer);
  };
}

/** "18:00" for minutes after midnight. */
export function formatMinute(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
