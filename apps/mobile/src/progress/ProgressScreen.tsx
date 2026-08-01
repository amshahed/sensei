import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ProgressDto } from '@sensei/types';
import { api } from '../api';
import { PrimaryButton, ui } from '../ui';

const TYPE_LABELS: Record<string, string> = {
  KANA: 'Kana',
  VOCAB: 'Vocab',
  KANJI: 'Kanji',
  GRAMMAR: 'Grammar',
};

/** Round a 0-1 value to a display percentage. */
function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

/**
 * Progress Dashboard (J.2): aggregate mastery, per-type breakdown, modality
 * profile, and weekly learning-rate callout.
 */
export function ProgressScreen({ onBack }: { onBack?: () => void }) {
  const [data, setData] = useState<ProgressDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .progress()
      .then((d) => {
        if (!active) return;
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        setError(String(e));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(load, [load]);

  if (loading) {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
        <Text style={ui.hint}>Loading progress…</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={ui.center}>
        <Text style={ui.err}>Couldn't load progress</Text>
        <Text style={ui.hint}>{error ?? 'Unknown error'}</Text>
      </View>
    );
  }

  const { aggregate, byType, modality, recentRate } = data;
  const trendUp = recentRate.thisWeek >= recentRate.lastWeek;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={ui.title}>Progress</Text>
      {onBack ? <PrimaryButton label="← Back" onPress={onBack} /> : null}

      {/* ── Aggregate hero ── */}
      <View style={styles.hero}>
        <Text style={styles.heroNumber}>{aggregate.masteredPercent}%</Text>
        <Text style={styles.heroLabel}>Foundation mastered</Text>
        <Text style={ui.hint}>
          {aggregate.masteredCount} of {aggregate.totalItems} items
        </Text>
      </View>

      {/* ── Per-type breakdown ── */}
      <Text style={styles.sectionTitle}>By item type</Text>
      {byType.map((t) => (
        <View key={t.type} style={styles.row}>
          <Text style={styles.rowLabel}>{TYPE_LABELS[t.type] ?? t.type}</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${t.totalItems > 0 ? Math.round((t.masteredCount / t.totalItems) * 100) : 0}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.rowValue}>
            {t.masteredCount}/{t.totalItems}
          </Text>
        </View>
      ))}

      {/* ── Modality profile ── */}
      <Text style={styles.sectionTitle}>Modality profile</Text>
      <View style={styles.modalityGrid}>
        {(
          [
            ['Recognition', modality.recognition],
            ['Recall', modality.recall],
            ['Production', modality.production],
          ] as [string, number][]
        ).map(([label, val]) => (
          <View key={label} style={styles.modalityCell}>
            <Text style={styles.modalityValue}>{pct(val)}</Text>
            <Text style={styles.modalityLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* ── Weekly rate ── */}
      <Text style={styles.sectionTitle}>Weekly pace</Text>
      <View style={styles.rateRow}>
        <View style={styles.rateBox}>
          <Text style={styles.rateNum}>{recentRate.thisWeek}</Text>
          <Text style={styles.rateLabel}>This week</Text>
        </View>
        <Text style={[styles.trend, trendUp ? styles.trendUp : styles.trendDown]}>
          {trendUp ? '↑' : '↓'}
        </Text>
        <View style={styles.rateBox}>
          <Text style={styles.rateNum}>{recentRate.lastWeek}</Text>
          <Text style={styles.rateLabel}>Last week</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 8 },
  hero: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  heroNumber: { fontSize: 64, fontWeight: '800', color: '#4A6CF7' },
  heroLabel: { fontSize: 16, color: '#555', fontWeight: '500' },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  rowLabel: { width: 80, fontSize: 14, color: '#555' },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#EEE',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: '#4A6CF7', borderRadius: 4 },
  rowValue: { width: 48, fontSize: 13, color: '#555', textAlign: 'right' },
  modalityGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  modalityCell: {
    flex: 1,
    backgroundColor: '#F7F8FE',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  modalityValue: { fontSize: 22, fontWeight: '700', color: '#4A6CF7' },
  modalityLabel: { fontSize: 12, color: '#666' },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  rateBox: {
    flex: 1,
    backgroundColor: '#F7F8FE',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  rateNum: { fontSize: 32, fontWeight: '700' },
  rateLabel: { fontSize: 13, color: '#666' },
  trend: { fontSize: 32, fontWeight: '700' },
  trendUp: { color: '#0E8A16' },
  trendDown: { color: '#B60205' },
});
