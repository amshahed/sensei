import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { AssessmentResultDto, AssessmentStartDto } from '@sensei/types';
import { api } from '../api';
import { PrimaryButton, Screen, ui } from '../ui';

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'intro'; test: AssessmentStartDto }
  | { kind: 'question'; test: AssessmentStartDto; index: number }
  | { kind: 'submitting'; test: AssessmentStartDto }
  | { kind: 'submitError'; test: AssessmentStartDto; message: string }
  | { kind: 'result'; test: AssessmentStartDto; result: AssessmentResultDto };

/**
 * Chapter Assessment (I.4.d.a): one engine for the skip-test (before the
 * chapter's lessons) and the exit Assessment (after). Test-style: every answer
 * is collected, submitted once, and scored at the end with corrections.
 */
export function AssessmentScreen({
  chapterId,
  onExit,
}: {
  chapterId: string;
  onExit: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState('');

  useEffect(() => {
    let active = true;
    api
      .startAssessment(chapterId)
      .then((test) => active && setPhase({ kind: 'intro', test }))
      .catch(
        (e: unknown) =>
          active && setPhase({ kind: 'error', message: String(e) }),
      );
    return () => {
      active = false;
    };
  }, [chapterId]);

  const submit = useCallback(
    (test: AssessmentStartDto, all: Record<string, string>) => {
      setPhase({ kind: 'submitting', test });
      api
        .submitAssessment(
          test.attemptId,
          test.questions.map((q) => ({
            itemId: q.itemId,
            answer: all[q.itemId] ?? '',
          })),
        )
        .then((result) => setPhase({ kind: 'result', test, result }))
        .catch((e: unknown) =>
          setPhase({ kind: 'submitError', test, message: String(e) }),
        );
    },
    [],
  );

  if (phase.kind === 'loading' || phase.kind === 'submitting') {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
        <Text style={ui.hint}>
          {phase.kind === 'loading' ? 'Preparing your test…' : 'Scoring…'}
        </Text>
      </View>
    );
  }

  if (phase.kind === 'error' || phase.kind === 'submitError') {
    return (
      <View style={ui.center}>
        <Text style={ui.err}>
          {phase.kind === 'error'
            ? 'Couldn’t start the test'
            : 'Couldn’t submit your answers'}
        </Text>
        <Text style={ui.hint}>{phase.message}</Text>
        {phase.kind === 'submitError' ? (
          <PrimaryButton
            label="Retry"
            onPress={() => submit(phase.test, answers)}
          />
        ) : null}
        <Pressable onPress={onExit} accessibilityRole="button">
          <Text style={ui.hint}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const { test } = phase;
  const skip = test.kind === 'SKIP';
  const pct = Math.round(test.passThreshold * 100);

  if (phase.kind === 'intro') {
    return (
      <Screen
        footer={
          <PrimaryButton
            label="Start"
            onPress={() => setPhase({ kind: 'question', test, index: 0 })}
          />
        }
      >
        <Text style={ui.kicker}>
          {skip ? 'Skip test' : 'Chapter assessment'}
        </Text>
        <Text style={ui.title}>{test.chapterTitle}</Text>
        <Text style={ui.body}>
          {test.questions.length} question
          {test.questions.length === 1 ? '' : 's'} · get {pct}% right to{' '}
          {skip ? 'skip this chapter' : 'complete the chapter'}.
        </Text>
        <Text style={ui.body}>
          Type each answer; you’ll see your score and corrections at the end.
        </Text>
        <Text style={ui.hint}>
          {skip
            ? 'Not passing costs nothing: anything you get right still counts, and you can retry any time.'
            : 'Anything you miss comes back in your reviews. You can retry any time.'}
        </Text>
        <Pressable onPress={onExit} accessibilityRole="button">
          <Text style={ui.hint}>Not now</Text>
        </Pressable>
      </Screen>
    );
  }

  if (phase.kind === 'question') {
    const q = test.questions[phase.index];
    const last = phase.index === test.questions.length - 1;
    const next = () => {
      const all = { ...answers, [q.itemId]: draft.trim() };
      setAnswers(all);
      setDraft('');
      if (last) submit(test, all);
      else setPhase({ kind: 'question', test, index: phase.index + 1 });
    };
    return (
      <Screen
        footer={
          <PrimaryButton label={last ? 'Submit' : 'Next'} onPress={next} />
        }
      >
        <Text style={ui.kicker}>
          Question {phase.index + 1} of {test.questions.length}
        </Text>
        <Text style={styles.prompt}>{q.prompt}</Text>
        <TextInput
          key={q.itemId}
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={next}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType={last ? 'done' : 'next'}
          placeholder="Your answer"
          accessibilityLabel="Your answer"
        />
        <Text style={ui.hint}>Not sure? Leave it blank and move on.</Text>
      </Screen>
    );
  }

  const { result } = phase;
  const missed = result.results.filter((r) => !r.correct);
  return (
    <Screen footer={<PrimaryButton label="Done" onPress={onExit} />}>
      <Text style={ui.kicker}>{skip ? 'Skip test' : 'Chapter assessment'}</Text>
      <Text style={ui.title}>
        {result.passed ? 'Passed 🎉' : 'Not this time'}
      </Text>
      <Text style={ui.body}>
        {result.correct} of {result.total} right ({pct}% needed).
      </Text>
      <Text style={ui.body}>
        {result.passed
          ? skip
            ? `${test.chapterTitle} is skipped. On to the next chapter.`
            : `${test.chapterTitle} is complete.`
          : skip
            ? 'No penalty: what you got right still counts. Start the chapter normally, or retry any time.'
            : 'The items you missed will come back in your reviews. Retry whenever you’re ready.'}
      </Text>
      {!result.passed && result.skippedLessonIds.length > 0 ? (
        <Text style={ui.ok}>
          {result.skippedLessonIds.length} lesson
          {result.skippedLessonIds.length === 1 ? '' : 's'} you clearly know
          will be skipped.
        </Text>
      ) : null}
      {missed.length > 0 ? (
        <View style={styles.missed}>
          <Text style={styles.missedTitle}>To review</Text>
          {missed.map((r) => (
            <View key={r.itemId} style={styles.missedRow}>
              <Text style={ui.body}>{r.prompt}</Text>
              <Text style={ui.hint}>
                You: {r.answer || '—'} · Answer: {r.correctAnswer}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  prompt: { fontSize: 22, fontWeight: '600', marginVertical: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
  },
  missed: { gap: 10, marginTop: 8 },
  missedTitle: { fontSize: 16, fontWeight: '700' },
  missedRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5e5',
    paddingTop: 8,
    gap: 2,
  },
});
