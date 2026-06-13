import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { DueReviewItemDto, ReviewResultDto } from '@sensei/types';
import { api } from '../api';
import { PrimaryButton, Screen, ui } from '../ui';

/**
 * Runs a spaced-repetition review session (#7 / G.4): pulls the due queue
 * (lowest-retention-first, capped server-side), runs each item as typed recall,
 * writes each answer back into FSRS + mastery, and shows a summary. Items not
 * due are never surfaced, so finishing the queue clears the due count.
 */
type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | { kind: 'review'; queue: DueReviewItemDto[]; index: number; correct: number }
  | { kind: 'done'; correct: number; total: number };

export function ReviewSession({ onExit }: { onExit?: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    api
      .dueReviews()
      .then((queue) => {
        if (!active) return;
        setPhase(
          queue.length === 0
            ? { kind: 'empty' }
            : { kind: 'review', queue, index: 0, correct: 0 },
        );
      })
      .catch((e) => active && setPhase({ kind: 'error', message: String(e) }));
    return () => {
      active = false;
    };
  }, []);

  if (phase.kind === 'loading') {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
        <Text style={ui.hint}>Loading reviews…</Text>
      </View>
    );
  }

  if (phase.kind === 'error') {
    return (
      <View style={ui.center}>
        <Text style={ui.err}>Couldn’t load reviews</Text>
        <Text style={ui.hint}>{phase.message}</Text>
        {onExit ? <PrimaryButton label="Back" onPress={onExit} /> : null}
      </View>
    );
  }

  if (phase.kind === 'empty') {
    return (
      <View style={ui.center}>
        <Text style={styles.emoji}>✅</Text>
        <Text style={ui.title}>All caught up</Text>
        <Text style={ui.body}>Nothing is due right now — you’re on track.</Text>
        {onExit ? <PrimaryButton label="Back to home" onPress={onExit} /> : null}
      </View>
    );
  }

  if (phase.kind === 'done') {
    return (
      <View style={ui.center}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={ui.title}>Review complete</Text>
        <Text style={ui.body}>
          You got {phase.correct} of {phase.total} right.
        </Text>
        {onExit ? <PrimaryButton label="Back to home" onPress={onExit} /> : null}
      </View>
    );
  }

  const { queue, index, correct } = phase;
  const item = queue[index];
  return (
    <ReviewCard
      key={item.itemId}
      item={item}
      index={index}
      total={queue.length}
      onNext={(wasCorrect) => {
        const nextCorrect = correct + (wasCorrect ? 1 : 0);
        const next = index + 1;
        if (next < queue.length) {
          setPhase({ kind: 'review', queue, index: next, correct: nextCorrect });
        } else {
          setPhase({ kind: 'done', correct: nextCorrect, total: queue.length });
        }
      }}
    />
  );
}

function ReviewCard({
  item,
  index,
  total,
  onNext,
}: {
  item: DueReviewItemDto;
  index: number;
  total: number;
  onNext: (correct: boolean) => void;
}) {
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<ReviewResultDto | null>(null);
  const [grading, setGrading] = useState(false);

  async function submit() {
    if (result || grading || answer.trim().length === 0) return;
    setGrading(true);
    try {
      const r = await api.gradeReview(item.itemId, answer);
      setResult(r);
    } catch {
      setResult({
        itemId: item.itemId,
        correct: false,
        correctAnswer: '',
        mastery: 0,
      });
    } finally {
      setGrading(false);
    }
  }

  return (
    <Screen
      footer={
        result ? (
          <PrimaryButton
            label={index + 1 < total ? 'Next →' : 'Finish'}
            onPress={() => onNext(result.correct)}
          />
        ) : (
          <PrimaryButton
            label="Check"
            onPress={submit}
            disabled={grading || answer.trim().length === 0}
          />
        )
      }
    >
      <Text style={ui.kicker}>
        Review {index + 1} of {total}
      </Text>
      <Text style={styles.glyph}>{item.display}</Text>
      <Text style={ui.body}>{item.prompt}</Text>

      <TextInput
        style={styles.input}
        value={answer}
        editable={!result}
        onChangeText={setAnswer}
        placeholder="Type your answer"
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={submit}
      />

      {result ? (
        <Text style={result.correct ? ui.ok : ui.err}>
          {result.correct
            ? 'Correct!'
            : `Answer: ${result.correctAnswer || '—'}`}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  emoji: { fontSize: 48 },
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
