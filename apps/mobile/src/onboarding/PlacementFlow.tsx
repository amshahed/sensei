import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type {
  PlacementQuestionDto,
  PlacementResultDto,
  PlacementStartDto,
} from '@sensei/types';
import { api, isPermanent } from '../api';
import { PrimaryButton, Screen, ui } from '../ui';
import { Option } from './IntakeScreen';

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'intro'; start: PlacementStartDto }
  | { kind: 'quiz'; start: PlacementStartDto; index: number }
  | { kind: 'result'; result: PlacementResultDto };

/**
 * Signup placement (I.3.d, I.4.f): an intro with the honest rules, then
 * multiple-choice questions in course order, one at a time, ending at the
 * first miss; then where the learner starts. Resumes an unfinished attempt.
 */
export function PlacementFlow({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [skipping, setSkipping] = useState(false);

  const load = useCallback(() => {
    let active = true;
    setPhase({ kind: 'loading' });
    api
      .startPlacement()
      .then((start) => {
        if (!active) return;
        setPhase(
          start.result
            ? { kind: 'result', result: start.result }
            : start.answered > 0
              ? { kind: 'quiz', start, index: start.answered }
              : { kind: 'intro', start },
        );
      })
      .catch(
        (e: unknown) =>
          active && setPhase({ kind: 'error', message: String(e) }),
      );
    return () => {
      active = false;
    };
  }, []);
  useEffect(load, [load]);

  if (phase.kind === 'loading') {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
        <Text style={ui.hint}>Preparing your placement…</Text>
      </View>
    );
  }
  if (phase.kind === 'error') {
    return (
      <View style={ui.center}>
        <Text style={ui.err}>Couldn’t load the placement quiz</Text>
        <Text style={ui.hint}>{phase.message}</Text>
        <PrimaryButton label="Retry" onPress={load} />
      </View>
    );
  }
  if (phase.kind === 'result') {
    return <ResultScreen result={phase.result} onDone={onDone} />;
  }
  if (phase.kind === 'intro') {
    const { start } = phase;
    const skip = () => {
      setSkipping(true);
      api
        .skipPlacement()
        .then((result) => setPhase({ kind: 'result', result }))
        .catch((e: unknown) => setPhase({ kind: 'error', message: String(e) }))
        .finally(() => setSkipping(false));
    };
    return (
      <Screen
        footer={
          <View style={styles.buttons}>
            <PrimaryButton
              label="Start"
              onPress={() => setPhase({ kind: 'quiz', start, index: 0 })}
            />
            <PrimaryButton
              label={skipping ? 'Skipping…' : 'Skip — start from the beginning'}
              onPress={skip}
              disabled={skipping}
            />
          </View>
        }
      >
        <Text style={ui.title}>
          {start.tier === 'KANA'
            ? 'A quick kana check'
            : 'A quick placement check'}
        </Text>
        <Text style={ui.body}>
          So you don’t re-learn what you already know. Up to{' '}
          {start.questions.length} multiple-choice question
          {start.questions.length === 1 ? '' : 's'}, easiest first.
        </Text>
        <Text style={ui.body}>
          It stops at the first one you miss — that’s where you’ll start. Not
          sure? Tap “I don’t know” instead of guessing: a lucky guess can skip
          something you’d want to learn.
        </Text>
        <Text style={ui.hint}>
          You can always go back to an earlier chapter from Curriculum.
        </Text>
      </Screen>
    );
  }

  const { start, index } = phase;
  const question = start.questions[index];
  if (!question) {
    // Out of step with the server (e.g. the attempt finished elsewhere):
    // reload — the server returns the result or the right question.
    return (
      <View style={ui.center}>
        <Text style={ui.hint}>Picking up where you left off…</Text>
        <PrimaryButton label="Continue" onPress={load} />
      </View>
    );
  }
  return (
    <QuestionScreen
      key={question.itemId}
      attemptId={start.attemptId}
      question={question}
      index={index}
      total={start.questions.length}
      onAnswered={({ done, result }) =>
        done && result
          ? setPhase({ kind: 'result', result })
          : setPhase({ kind: 'quiz', start, index: index + 1 })
      }
      onLost={load}
    />
  );
}

function QuestionScreen({
  attemptId,
  question,
  index,
  total,
  onAnswered,
  onLost,
}: {
  attemptId: string;
  question: PlacementQuestionDto;
  index: number;
  total: number;
  onAnswered: (r: { done: boolean; result: PlacementResultDto | null }) => void;
  /** The attempt moved on elsewhere (e.g. another device): reload it. */
  onLost: () => void;
}) {
  const [picked, setPicked] = useState<(string | null)[]>(
    question.parts.map(() => null),
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = picked.every((p) => p !== null);

  const send = (choices: string[] | null) => {
    setSending(true);
    setError(null);
    api
      .answerPlacement(attemptId, question.itemId, choices)
      .then(onAnswered)
      .catch((e: unknown) => {
        // A 4xx means our view is stale (answered elsewhere, or already
        // over): resume from the server's state. Otherwise it's a blip.
        if (isPermanent(e)) onLost();
        else setError('Couldn’t save that answer — try again.');
      })
      .finally(() => setSending(false));
  };

  return (
    <Screen
      footer={
        <View style={styles.buttons}>
          <PrimaryButton
            label={sending ? 'Saving…' : 'Next'}
            disabled={!complete || sending}
            onPress={() => send(picked as string[])}
          />
          <PrimaryButton
            label="I don’t know"
            disabled={sending}
            onPress={() => send(null)}
          />
        </View>
      }
    >
      <Text style={ui.kicker}>
        Question {index + 1} of up to {total}
      </Text>
      {question.display ? (
        <Text style={styles.display}>{question.display}</Text>
      ) : null}
      <Text style={ui.body}>{question.prompt}</Text>
      {question.parts.map((part, p) => (
        <View key={part.label ?? p} style={styles.part}>
          {part.label ? <Text style={styles.label}>{part.label}</Text> : null}
          <View style={styles.choices}>
            {part.choices.map((c) => (
              <Option
                key={c}
                label={c}
                role="radio"
                selected={picked[p] === c}
                disabled={sending}
                onPress={() =>
                  setPicked((prev) => prev.map((x, i) => (i === p ? c : x)))
                }
              />
            ))}
          </View>
        </View>
      ))}
      {error ? <Text style={ui.err}>{error}</Text> : null}
    </Screen>
  );
}

function ResultScreen({
  result,
  onDone,
}: {
  result: PlacementResultDto;
  onDone: () => void;
}) {
  const { status, startChapter, skippedChapterCount } = result;
  return (
    <View style={ui.center}>
      <Text style={styles.emoji}>🧭</Text>
      {status === 'SKIPPED' ? (
        <Text style={[ui.body, styles.centered]}>
          You’ll start from the very beginning.
        </Text>
      ) : startChapter ? (
        <>
          <Text style={[ui.title, styles.centered]}>
            You’ll start at {startChapter.title}
          </Text>
          {skippedChapterCount > 0 ? (
            <Text style={[ui.body, styles.centered]}>
              We marked {skippedChapterCount} earlier chapter
              {skippedChapterCount === 1 ? '' : 's'} as known — you can go back
              to any of them from Curriculum.
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={[ui.body, styles.centered]}>
          You already know everything published so far — more lessons are on the
          way. Reviews and Practice keep it fresh meanwhile.
        </Text>
      )}
      <PrimaryButton label="Let’s go" onPress={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: { gap: 10 },
  display: { fontSize: 56, fontWeight: '600', textAlign: 'center' },
  part: { gap: 8, marginTop: 4 },
  label: { fontSize: 14, fontWeight: '700', color: '#555' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emoji: { fontSize: 48 },
  centered: { textAlign: 'center' },
});
