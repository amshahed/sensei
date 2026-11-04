import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import type { ReviewResultDto } from '@sensei/types';
import { isPermanent } from '../api';
import { PrimaryButton, Screen, ui } from '../ui';

/**
 * One typed-recall question with review-style immediate feedback (G.4 /
 * J.1.d). Shared by Reviews and Practice: the caller supplies how to grade
 * and gets the result (or null when the item was skipped) on "Next".
 */
export function RecallCard<R extends ReviewResultDto>({
  kicker,
  display,
  prompt,
  last,
  grade,
  note,
  onNext,
}: {
  kicker: string;
  display: string;
  prompt: string;
  /** The final card ("Finish" vs "Next"); may depend on the answer's result. */
  last: boolean | ((result: R | null) => boolean);
  grade: (answer: string) => Promise<R>;
  /** Extra caller-specific line under the verdict (e.g. "practice only"). */
  note?: (result: R) => string | null;
  onNext: (result: R | null) => void;
}) {
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<R | null>(null);
  const [grading, setGrading] = useState(false);
  // 'retry': a blip — don't score it, let the learner retry.
  // 'skip': the server says this item can't be checked (4xx) — retrying
  // won't help, so let them move on.
  const [failed, setFailed] = useState<'retry' | 'skip' | null>(null);

  async function submit() {
    if (result || grading || answer.trim().length === 0) return;
    setGrading(true);
    setFailed(null);
    try {
      setResult(await grade(answer));
    } catch (err) {
      setFailed(isPermanent(err) ? 'skip' : 'retry');
    } finally {
      setGrading(false);
    }
  }

  const extra = result && note ? note(result) : null;
  const isLast = typeof last === 'function' ? last(result) : last;
  return (
    <Screen
      footer={
        result || failed === 'skip' ? (
          <PrimaryButton
            label={failed === 'skip' ? 'Skip' : isLast ? 'Finish' : 'Next →'}
            onPress={() => onNext(result)}
          />
        ) : (
          <PrimaryButton
            label={failed === 'retry' ? 'Retry' : 'Check'}
            onPress={submit}
            disabled={grading || answer.trim().length === 0}
          />
        )
      }
    >
      <Text style={ui.kicker}>{kicker}</Text>
      <Text style={styles.glyph}>{display}</Text>
      <Text style={ui.body}>{prompt}</Text>

      <TextInput
        style={styles.input}
        value={answer}
        editable={!result && !grading}
        onChangeText={setAnswer}
        placeholder="Type your answer"
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={submit}
      />

      {failed === 'retry' ? (
        <Text style={ui.err}>Couldn’t reach the grader — tap Retry.</Text>
      ) : null}
      {failed === 'skip' ? (
        <Text style={ui.err}>This item can’t be checked right now.</Text>
      ) : null}

      {result && !result.scored ? (
        <Text style={ui.hint}>
          Couldn’t grade that right now, so it doesn’t count. Answer:{' '}
          {result.correctAnswer || '—'}
        </Text>
      ) : result ? (
        <Text style={result.correct ? ui.ok : ui.err}>
          {result.correct
            ? 'Correct!'
            : `Answer: ${result.correctAnswer || '—'}`}
        </Text>
      ) : null}
      {result?.feedback ? <Text style={ui.hint}>{result.feedback}</Text> : null}
      {extra ? <Text style={ui.hint}>{extra}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  glyph: { fontSize: 64, fontWeight: '600', textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
  },
});
