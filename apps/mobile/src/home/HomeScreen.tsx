import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CurriculumNextDto, NextStepDto } from '@sensei/types';
import { api } from '../api';
import { RemindersCard } from '../reminders/RemindersCard';
import { StreakCard } from '../streak/StreakCard';
import { ui } from '../ui';

type Next = CurriculumNextDto['next'];

/**
 * Home / launcher: "Continue" opens the learner's next step from the
 * Curriculum Outline (I.4.e) — a lesson, or a chapter's exit Assessment
 * (I.4.d.a) — and the Reviews tile shows the live due count
 * (G.4 entry point). Below them, a calm learning-streak line (K.2) and
 * the reminders line / one-time offer (K.3.g).
 * Curriculum, Practice and Progress live in their own tabs.
 */
export function HomeScreen({
  onContinue,
  onStartReview,
}: {
  onContinue: (step: NextStepDto) => void;
  onStartReview: () => void;
}) {
  const [dueCount, setDueCount] = useState<number | null>(null);
  // undefined = loading; null = nothing left; 'error' = fetch failed.
  const [next, setNext] = useState<Next | undefined | 'error'>(undefined);

  const refresh = useCallback(() => {
    let active = true;
    api
      .dueReviews()
      .then((q) => active && setDueCount(q.length))
      .catch(() => active && setDueCount(null));
    setNext(undefined);
    api
      .curriculumNext()
      .then((c) => active && setNext(c.next))
      .catch(() => active && setNext('error'));
    return () => {
      active = false;
    };
  }, []);

  useEffect(refresh, [refresh]);

  const step = next && next !== 'error' ? next : null;

  return (
    <View style={[ui.screen, styles.pad]}>
      <Text style={styles.brand}>先生 Sensei</Text>

      <Pressable
        style={[styles.tile, !step && next !== 'error' && styles.tileDisabled]}
        onPress={
          step ? () => onContinue(step) : next === 'error' ? refresh : undefined
        }
        disabled={!step && next !== 'error'}
        accessibilityRole="button"
      >
        <Text style={styles.tileTitle}>Continue</Text>
        <Text style={ui.hint}>
          {next === undefined
            ? 'Loading…'
            : next === 'error'
              ? 'Couldn’t load your next lesson — tap to retry'
              : next === null
                ? "You're through everything published so far"
                : next.kind === 'assessment'
                  ? `Chapter assessment: ${next.chapterTitle}`
                  : next.title}
        </Text>
      </Pressable>

      <Pressable style={styles.tile} onPress={onStartReview}>
        <View style={styles.tileRow}>
          <Text style={styles.tileTitle}>Reviews</Text>
          {dueCount !== null && dueCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{dueCount}</Text>
            </View>
          ) : null}
        </View>
        <Text style={ui.hint}>
          {dueCount === null
            ? 'Due count unavailable'
            : dueCount === 0
              ? "Nothing due — you're on track"
              : `${dueCount} item${dueCount === 1 ? '' : 's'} due now`}
        </Text>
      </Pressable>

      {/* Secondary by design (K.2): learning progress is the hero, not this. */}
      <StreakCard />
      <RemindersCard />
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 24, gap: 16, justifyContent: 'center' },
  brand: { fontSize: 32, fontWeight: '700', marginBottom: 12 },
  tile: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 16,
    padding: 20,
    gap: 6,
    backgroundColor: '#fafafa',
  },
  tileDisabled: { opacity: 0.6 },
  tileRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tileTitle: { fontSize: 20, fontWeight: '600' },
  badge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: '#B60205',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
