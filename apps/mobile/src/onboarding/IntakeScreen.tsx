import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type {
  DailyTargetMinutes,
  IntakeRequest,
  Interest,
  PriorExperience,
} from '@sensei/types';
import { DAILY_TARGET_OPTIONS } from '../streak/targets';
import { PrimaryButton, Screen, ui } from '../ui';

const INTERESTS: { id: Interest; label: string }[] = [
  { id: 'TRAVEL', label: 'Travel' },
  { id: 'ANIME_MANGA', label: 'Anime / Manga' },
  { id: 'LIVE_WORK', label: 'Live or work in Japan' },
  { id: 'FRIENDS_FAMILY', label: 'Talk with friends / family' },
  { id: 'JLPT', label: 'Pass a JLPT exam' },
  { id: 'CURIOUS', label: 'Just curious' },
];
const PRIOR: { id: PriorExperience; label: string }[] = [
  { id: 'NONE', label: 'None — total beginner' },
  { id: 'SOME_KANA', label: 'Some kana / basic phrases' },
  { id: 'FAIR_AMOUNT', label: 'A fair amount of vocab and grammar' },
  { id: 'REFRESHER', label: 'Studied before, refreshing' },
];

/**
 * Signup survey (I.3.b): three light questions, ~30 seconds. Honest about
 * what it's for — interests only theme some examples; real personalization
 * starts after Foundation.
 */
export function IntakeScreen({
  onSubmit,
  submitting,
  error,
}: {
  onSubmit: (req: IntakeRequest) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [interests, setInterests] = useState<Set<Interest>>(new Set());
  const [prior, setPrior] = useState<PriorExperience | null>(null);
  const [target, setTarget] = useState<DailyTargetMinutes>(10);

  const toggle = (id: Interest) =>
    setInterests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const ready = interests.size > 0 && prior !== null && !submitting;

  return (
    <Screen
      footer={
        <PrimaryButton
          label={submitting ? 'Saving…' : 'Continue'}
          disabled={!ready}
          onPress={() =>
            prior &&
            onSubmit({
              interests: [...interests],
              priorExperience: prior,
              dailyTargetMinutes: target,
            })
          }
        />
      }
    >
      <Text style={ui.title}>Welcome to Sensei</Text>
      <Text style={ui.body}>
        Three quick questions before your first lesson.
      </Text>

      <Text style={styles.q}>What pulled you to learn Japanese?</Text>
      <Text style={ui.hint}>
        Pick any. We’ll use this to theme some example sentences — everyone
        learns the same core first; real personalization starts after that.
      </Text>
      <View style={styles.wrap}>
        {INTERESTS.map((o) => (
          <Option
            key={o.id}
            label={o.label}
            selected={interests.has(o.id)}
            onPress={() => toggle(o.id)}
            role="checkbox"
          />
        ))}
      </View>

      <Text style={styles.q}>Have you studied any Japanese before?</Text>
      <View style={styles.stack}>
        {PRIOR.map((o) => (
          <Option
            key={o.id}
            label={o.label}
            selected={prior === o.id}
            onPress={() => setPrior(o.id)}
            role="radio"
          />
        ))}
      </View>

      <Text style={styles.q}>How much time per day?</Text>
      <View style={styles.wrap}>
        {DAILY_TARGET_OPTIONS.map((o) => (
          <Option
            key={o.id}
            label={o.label}
            selected={target === o.id}
            onPress={() => setTarget(o.id)}
            role="radio"
          />
        ))}
      </View>

      {error ? <Text style={ui.err}>{error}</Text> : null}
    </Screen>
  );
}

export function Option({
  label,
  selected,
  onPress,
  role,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  role: 'checkbox' | 'radio' | 'button';
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[
        styles.option,
        selected && styles.selected,
        disabled && ui.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityState={
        role === 'checkbox' ? { checked: selected } : { selected }
      }
    >
      <Text style={[styles.optionText, selected && styles.selectedText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  q: { fontSize: 17, fontWeight: '700', marginTop: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stack: { gap: 8 },
  option: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selected: { backgroundColor: '#111', borderColor: '#111' },
  optionText: { fontSize: 15, color: '#333' },
  selectedText: { color: '#fff', fontWeight: '600' },
});
