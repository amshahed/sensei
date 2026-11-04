import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReminderSettingsRequest, RemindersDto } from '@sensei/types';
import { api } from '../api';
import { ui } from '../ui';
import {
  applyPlan,
  clearScheduled,
  formatMinute,
  notificationsAllowed,
  remindersSupported,
  requestNotificationPermission,
  syncReminders,
} from './reminders';

/** Reminder time presets (K.3.g) — each leaves room for the 21:00 last call. */
const TIMES = [8 * 60, 12 * 60 + 30, 18 * 60];
const QUIET_STARTS = [21 * 60, 22 * 60, 23 * 60];
const QUIET_ENDS = [7 * 60, 8 * 60, 9 * 60];
const LAST_CALL = '21:00';

/**
 * Reminders on Home (K.3.d/K.3.g): the one-time offer after a first lesson,
 * then a single calm line with Edit and one-tap off. The OS permission
 * prompt only ever follows a tap on "Turn on".
 */
export function RemindersCard() {
  const [data, setData] = useState<RemindersDto | null>(null);
  const [allowed, setAllowed] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState(18 * 60);

  const load = useCallback(() => {
    let active = true;
    // The shared sync: fetches and schedules once, even with app start.
    void syncReminders().then(async (d) => {
      if (!d) return; // secondary: hide on failure
      const ok = await notificationsAllowed();
      if (!active) return;
      setData(d);
      setAllowed(ok);
      setPick(d.settings.minute);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(load, [load]);

  const save = (call: () => Promise<RemindersDto>) => {
    setBusy(true);
    call()
      .then((d) => {
        setData(d);
        void applyPlan(d);
      })
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };
  const update = (body: ReminderSettingsRequest) =>
    save(() => api.updateReminders(body));

  /** "Turn on": ask the OS first; a refusal still answers the offer. */
  const turnOn = (minute: number) =>
    save(async () => {
      const ok = await requestNotificationPermission().catch(() => false);
      setAllowed(ok);
      return api.updateReminders(ok ? { on: true, minute } : { on: false });
    });

  /** One tap off: cancel on the phone first, so it works offline too. */
  const turnOff = () => {
    void clearScheduled();
    update({ on: false });
  };

  if (!remindersSupported || !data) return null;
  const { settings, offer, fires } = data;

  if (offer) {
    return (
      <View style={styles.offer}>
        <Text style={ui.body}>
          Want a daily reminder? One at your time — what’s starting to fade, or
          your day’s target — plus a {LAST_CALL} last call only if the day isn’t
          done. Nothing once you’re done for the day.
        </Text>
        <Chips
          options={TIMES}
          value={pick}
          onPick={setPick}
          disabled={busy}
          label={formatMinute}
        />
        <View style={styles.row}>
          <Pressable
            style={styles.action}
            disabled={busy}
            onPress={() => turnOn(pick)}
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>Turn on</Text>
          </Pressable>
          <Pressable
            style={[styles.action, styles.quiet]}
            disabled={busy}
            onPress={() => save(() => api.dismissRemindersOffer())}
            accessibilityRole="button"
          >
            <Text style={styles.quietText}>Not now</Text>
          </Pressable>
        </View>
        {!allowed ? <Blocked /> : null}
      </View>
    );
  }

  if (!settings.on) {
    return (
      <View style={styles.card}>
        <Text style={ui.hint}>
          Reminders off{'  '}
          <Text
            style={styles.link}
            onPress={busy ? undefined : () => turnOn(settings.minute)}
            accessibilityRole="button"
          >
            Turn on
          </Text>
        </Text>
        {!allowed ? <Blocked /> : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={ui.hint}>
        {`Reminders · ${formatMinute(settings.minute)}`}
        {fires.lastCall ? ` · last call ${LAST_CALL}` : ''}
        {'  '}
        <Text
          style={styles.link}
          onPress={() => setEditing((e) => !e)}
          accessibilityRole="button"
        >
          {editing ? 'Done' : 'Edit'}
        </Text>
        {'  '}
        <Text
          style={styles.link}
          onPress={busy ? undefined : turnOff}
          accessibilityRole="button"
        >
          Turn off
        </Text>
      </Text>
      {!allowed ? <Blocked /> : null}
      {!fires.primary ? (
        <Text style={ui.hint}>
          {`${formatMinute(settings.minute)} is inside your quiet hours, so that reminder won’t ring. Pick another time or change quiet hours.`}
        </Text>
      ) : null}

      {editing ? (
        <View style={styles.edit}>
          <Text style={styles.label}>Remind me at</Text>
          <Chips
            options={TIMES}
            value={settings.minute}
            onPick={(minute) => update({ minute })}
            disabled={busy}
            label={formatMinute}
          />
          <Text style={styles.label}>
            Last call at {LAST_CALL} (only if the day isn’t done)
            {settings.evening && !fires.lastCall
              ? ' — won’t ring with these quiet hours'
              : ''}
          </Text>
          <Chips
            options={[1, 0]}
            value={settings.evening ? 1 : 0}
            onPick={(v) => update({ evening: v === 1 })}
            disabled={busy}
            label={(v) => (v ? 'On' : 'Off')}
          />
          <Text style={styles.label}>Quiet from</Text>
          <Chips
            options={QUIET_STARTS}
            value={settings.quietStartMinute}
            onPick={(quietStartMinute) => update({ quietStartMinute })}
            disabled={busy}
            label={formatMinute}
          />
          <Text style={styles.label}>Quiet until</Text>
          <Chips
            options={QUIET_ENDS}
            value={settings.quietEndMinute}
            onPick={(quietEndMinute) => update({ quietEndMinute })}
            disabled={busy}
            label={formatMinute}
          />
        </View>
      ) : null}
    </View>
  );
}

/** The OS has notifications off for the app: say so, and where to fix it. */
function Blocked() {
  return (
    <Text style={ui.hint}>
      Notifications are off for Sensei in your phone’s settings.{'  '}
      <Text
        style={styles.link}
        onPress={() => void Linking.openSettings()}
        accessibilityRole="link"
      >
        Open settings
      </Text>
    </Text>
  );
}

function Chips({
  options,
  value,
  onPick,
  disabled,
  label,
}: {
  options: number[];
  value: number;
  onPick: (v: number) => void;
  disabled: boolean;
  label: (v: number) => string;
}) {
  return (
    <View style={styles.chips}>
      {options.map((v) => (
        <Pressable
          key={v}
          style={[styles.chip, v === value && styles.chipOn]}
          disabled={disabled}
          onPress={() => onPick(v)}
          accessibilityRole="radio"
          accessibilityState={{ selected: v === value }}
        >
          <Text style={[styles.chipText, v === value && styles.chipTextOn]}>
            {label(v)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4, paddingHorizontal: 4 },
  offer: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F7F8FE',
    gap: 8,
  },
  edit: { gap: 4, marginTop: 4 },
  label: { fontSize: 13, color: '#555', marginTop: 6 },
  link: { color: '#1D4ED8', fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: '#111', borderColor: '#111' },
  chipText: { fontSize: 13, color: '#333' },
  chipTextOn: { color: '#fff' },
  row: { flexDirection: 'row', gap: 8 },
  action: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#111',
  },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  quiet: { backgroundColor: 'transparent' },
  quietText: { color: '#555', fontWeight: '600', fontSize: 14 },
});
