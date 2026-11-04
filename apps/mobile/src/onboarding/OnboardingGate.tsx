import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { IntakeRequest, OnboardingDto } from '@sensei/types';
import { api, ApiError } from '../api';
import { PrimaryButton, ui } from '../ui';
import { IntakeScreen } from './IntakeScreen';
import { PlacementFlow } from './PlacementFlow';

/**
 * Onboarding before the app (I.3.a/I.3.d): the signup survey, then — for
 * learners who've studied before — the placement quiz, in the same session.
 * Renders the app once nothing is owed.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OnboardingDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const load = useCallback(() => {
    let active = true;
    setError(null);
    api
      .onboarding()
      .then((s) => active && setState(s))
      .catch((e: unknown) => active && setError(String(e)));
    return () => {
      active = false;
    };
  }, []);
  useEffect(load, [load]);

  if (done) return <>{children}</>;
  if (error) {
    return (
      <View style={ui.center}>
        <Text style={ui.err}>Couldn’t reach Sensei</Text>
        <Text style={ui.hint}>{error}</Text>
        <PrimaryButton label="Retry" onPress={load} />
      </View>
    );
  }
  if (!state) {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!state.intakeDone) {
    const submit = (req: IntakeRequest) => {
      setSubmitting(true);
      setSubmitError(null);
      api
        .submitIntake(req)
        .then(setState)
        .catch((e: unknown) => {
          // Already submitted (another device / a retried request): move on.
          if (e instanceof ApiError && e.status === 409) load();
          else setSubmitError('Couldn’t save your answers — try again.');
        })
        .finally(() => setSubmitting(false));
    };
    return (
      <IntakeScreen
        onSubmit={submit}
        submitting={submitting}
        error={submitError}
      />
    );
  }
  if (state.placement === 'pending') {
    return <PlacementFlow onDone={() => setDone(true)} />;
  }
  return <>{children}</>;
}
