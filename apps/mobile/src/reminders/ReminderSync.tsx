import { useEffect } from 'react';
import { startReminderSync } from './reminders';

/**
 * Keeps scheduled reminders in step with the server plan while a signed-in,
 * onboarded learner has the app (K.3.g). Renders nothing.
 */
export function ReminderSync() {
  useEffect(() => startReminderSync(), []);
  return null;
}
