import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { AgeAnswer, IntakeRequest, OnboardingDto } from '@sensei/types';
import { api, ApiError } from '../api';
import { PrimaryButton, ui } from '../ui';
import { AdultsOnly, AgeQuestion } from './AgeScreen';
import { IntakeScreen } from './IntakeScreen';
import { PlacementFlow } from './PlacementFlow';

/**
 * Onboarding before the app (M.5.a, I.3.a/I.3.d): the age question, then the
 * signup survey, then — for learners who've studied before — the placement
 * quiz, in the same session. Renders the app once nothing is owed. Status is
 * re-read on every launch, so the age answer holds across launches and devices.
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
  // Unanswered. A missing field (an API from before the age question) asks
  // too, rather than telling an adult they're under 18.
  if (!state.ageAnswer) {
    const answer = (a: AgeAnswer) => {
      setSubmitting(true);
      setSubmitError(null);
      api
        .answerAge(a)
        // The stored answer comes back, even if another device answered first.
        .then(setState)
        .catch(() => setSubmitError('Couldn’t save your answer — try again.'))
        .finally(() => setSubmitting(false));
    };
    return (
      <AgeQuestion
        onAnswer={answer}
        submitting={submitting}
        error={submitError}
      />
    );
  }
  // Only an adult goes on; anything else stops here (fails closed).
  if (state.ageAnswer !== 'ADULT') return <AdultsOnly />;
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
