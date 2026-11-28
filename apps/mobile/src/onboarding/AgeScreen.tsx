import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AgeAnswer } from '@sensei/types';
import { useSignOut } from '../auth/AuthGate';
import { PrimaryButton, Screen, ui } from '../ui';
import { Option } from './IntakeScreen';

/** Same component, same style, no pre-selection: neither answer is the "right" one. */
const CHOICES: { id: AgeAnswer; label: string }[] = [
  { id: 'ADULT', label: 'I’m 18 or older' },
  { id: 'UNDER_18', label: 'I’m under 18' },
];

/**
 * The age question, before anything else in onboarding (M.5, M.5.a). The
 * beta is for adults while runtime grading uses Gemini. One tap answers it:
 * there is no Continue step, and no birth date or proof is asked for.
 */
export function AgeQuestion({
  onAnswer,
  submitting,
  error,
}: {
  onAnswer: (answer: AgeAnswer) => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <Screen>
      <Text style={ui.body}>Sensei’s beta is for adults for now.</Text>
      <Text style={styles.q}>Are you 18 or older?</Text>
      <View style={styles.stack}>
        {CHOICES.map((c) => (
          <Option
            key={c.id}
            label={c.label}
            selected={false}
            onPress={() => onAnswer(c.id)}
            role="button"
            disabled={submitting}
          />
        ))}
      </View>
      {submitting ? <Text style={ui.hint}>Saving…</Text> : null}
      {error ? <Text style={ui.err}>{error}</Text> : null}
    </Screen>
  );
}

/**
 * Where an "I'm under 18" answer stops (M.5.a). The answer sticks, so this is
 * shown on every later launch too. Nothing here reaches the API; a mis-tap is
 * reset by the team (age-confirmation tech.md 3.4). With a real account the
 * learner can sign out; in dev-stub mode there is no account, so no button.
 */
export function AdultsOnly() {
  const signOut = useSignOut();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignOut = signOut
    ? () => {
        setSigningOut(true);
        setError(null);
        signOut().catch(() => {
          setSigningOut(false);
          setError('Couldn’t sign out — try again.');
        });
      }
    : null;

  return (
    <Screen
      footer={
        onSignOut ? (
          <PrimaryButton
            label={signingOut ? 'Signing out…' : 'Sign out'}
            disabled={signingOut}
            onPress={onSignOut}
          />
        ) : undefined
      }
    >
      <Text style={ui.title}>Sensei is for adults for now</Text>
      <Text style={ui.body}>
        The beta is open to people aged 18 and over. Thank you for wanting to
        learn Japanese with us.
      </Text>
      <Text style={ui.body}>
        Tapped “I’m under 18” by mistake? Contact the person who invited you,
        and they’ll reset it.
      </Text>
      {error ? <Text style={ui.err}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  q: { fontSize: 17, fontWeight: '700' },
  stack: { gap: 8, marginTop: 4 },
});
