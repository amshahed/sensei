import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StreakDto } from '@sensei/types';
import { api } from '../api';
import { ui } from '../ui';
import { DAILY_TARGET_OPTIONS } from './targets';

/**
 * The learning streak as a calm, secondary line (K.2 #2): today's progress
 * toward "day done" (reviews cleared + effort target), the run of done days,
 * banked freezes, and — only when the data says so — a target suggestion the
 * learner can accept or wave off (K.3.c). No confetti, no streak milestones.
 */
export function StreakCard() {
  const [data, setData] = useState<StreakDto | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    let active = true;
    api
      .streak()
      .then((d) => active && setData(d))
      .catch(() => undefined); // secondary: hide on failure
    return () => {
      active = false;
    };
  }, []);
  useEffect(load, [load]);

  const act = (call: () => Promise<StreakDto>) => {
    setBusy(true);
    call()
      .then((d) => {
        setData(d);
        setEditing(false);
      })
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };

  if (!data) return null;
  const { days, today, freezes, suggestion } = data;

  return (
    <View style={styles.card}>
      <Text style={styles.line}>
        {days > 0
          ? `Learning streak · ${days} day${days === 1 ? '' : 's'}`
          : 'Learning streak · starts with today'}
        {freezes > 0
          ? ` · ${freezes} freeze${freezes === 1 ? '' : 's'} banked`
          : ''}
      </Text>
      <Text style={ui.hint}>
        {today.done
          ? 'Today’s done.'
          : [
              today.reviewsRemaining > 0
                ? `${today.reviewsRemaining} review${today.reviewsRemaining === 1 ? '' : 's'} to go`
                : 'Reviews ✓',
              `${Math.min(today.effortMinutes, today.targetMinutes)} of ${today.targetMinutes} min`,
            ].join(' · ')}
        {'  '}
        <Text
          style={styles.link}
          onPress={() => setEditing((e) => !e)}
          accessibilityRole="button"
        >
          {editing ? 'Done' : 'Change target'}
        </Text>
      </Text>

      {editing ? (
        <View style={styles.chips}>
          {DAILY_TARGET_OPTIONS.map(({ id: m, label }) => (
            <Pressable
              key={m}
              style={[styles.chip, m === today.targetMinutes && styles.chipOn]}
              disabled={busy}
              onPress={() => act(() => api.setDailyTarget(m))}
              accessibilityRole="radio"
              accessibilityState={{ selected: m === today.targetMinutes }}
            >
              <Text
                style={[
                  styles.chipText,
                  m === today.targetMinutes && styles.chipTextOn,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {suggestion && !editing ? (
        <View style={styles.suggestion}>
          <Text style={ui.body}>
            {suggestion.direction === 'up'
              ? `You’ve been doing about twice your target lately. Raise it to ${suggestion.targetMinutes} min a day?`
              : `Your target has been hard to reach lately — that’s fine. Try ${suggestion.targetMinutes} min a day for now?`}
          </Text>
          <View style={styles.row}>
            <Pressable
              style={styles.action}
              disabled={busy}
              onPress={() =>
                act(() => api.setDailyTarget(suggestion.targetMinutes))
              }
              accessibilityRole="button"
            >
              <Text style={styles.actionText}>
                Set {suggestion.targetMinutes} min
              </Text>
            </Pressable>
            <Pressable
              style={[styles.action, styles.quiet]}
              disabled={busy}
              onPress={() => act(() => api.dismissTargetSuggestion())}
              accessibilityRole="button"
            >
              <Text style={styles.quietText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4, paddingHorizontal: 4 },
  line: { fontSize: 14, color: '#555', fontWeight: '600' },
  link: { color: '#1D4ED8', fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
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
  suggestion: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F7F8FE',
    gap: 8,
  },
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
