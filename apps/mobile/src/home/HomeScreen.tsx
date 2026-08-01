import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { ui } from '../ui';

/**
 * Minimal home / launcher (#7): a Start-lesson tile and a Reviews tile that
 * shows the live due count (G.4 entry point). Real navigation + curriculum
 * outline arrive in #14; this is a deliberately tiny state-routed shell.
 */
export function HomeScreen({
  onStartLesson,
  onStartReview,
  onShowProgress,
}: {
  onStartLesson: () => void;
  onStartReview: () => void;
  onShowProgress: () => void;
}) {
  const [dueCount, setDueCount] = useState<number | null>(null);

  const refresh = useCallback(() => {
    let active = true;
    api
      .dueReviews()
      .then((q) => active && setDueCount(q.length))
      .catch(() => active && setDueCount(null));
    return () => {
      active = false;
    };
  }, []);

  useEffect(refresh, [refresh]);

  return (
    <View style={[ui.screen, styles.pad]}>
      <Text style={styles.brand}>先生 Sensei</Text>

      <Pressable style={styles.tile} onPress={onStartLesson}>
        <Text style={styles.tileTitle}>Start lesson</Text>
        <Text style={ui.hint}>The Five Vowels あいうえお</Text>
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

      <Pressable style={styles.tile} onPress={onShowProgress}>
        <Text style={styles.tileTitle}>Progress</Text>
        <Text style={ui.hint}>View your mastery dashboard</Text>
      </Pressable>
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
