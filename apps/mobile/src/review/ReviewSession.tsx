import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { DueReviewItemDto } from '@sensei/types';
import { api } from '../api';
import { RecallCard } from '../recall/RecallCard';
import { PrimaryButton, ui } from '../ui';

/**
 * Runs a spaced-repetition review session (#7 / G.4): pulls the due queue
 * (lowest-retention-first, capped server-side), runs each item as typed recall,
 * writes each answer back into FSRS + mastery, and shows a summary. Items not
 * due are never surfaced, so finishing the queue clears the due count. The
 * score counts graded cards only: one the grader couldn't judge isn't counted
 * either way and stays due (J.1.f, B.2.g).
 */
type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | {
      kind: 'review';
      queue: DueReviewItemDto[];
      index: number;
      correct: number;
      /** Cards that got a verdict. A skipped or ungraded card didn't. */
      graded: number;
    }
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
            : { kind: 'review', queue, index: 0, correct: 0, graded: 0 },
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
        {onExit ? (
          <PrimaryButton label="Back to home" onPress={onExit} />
        ) : null}
      </View>
    );
  }

  if (phase.kind === 'done') {
    return (
      <View style={ui.center}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={ui.title}>Review complete</Text>
        <Text style={ui.body}>
          {phase.total > 0
            ? `You got ${phase.correct} of ${phase.total} right.`
            : 'Nothing could be graded this time, so nothing counted. These cards will come back in your next review.'}
        </Text>
        {onExit ? (
          <PrimaryButton label="Back to home" onPress={onExit} />
        ) : null}
      </View>
    );
  }

  const { queue, index, correct, graded } = phase;
  const item = queue[index];
  return (
    <RecallCard
      key={item.itemId}
      kicker={`Review ${index + 1} of ${queue.length}`}
      display={item.display}
      prompt={item.prompt}
      last={index + 1 >= queue.length}
      grade={(answer) => api.gradeReview(item.itemId, answer)}
      onNext={(result) => {
        const wasGraded = !!result?.scored;
        const nextCorrect = correct + (wasGraded && result.correct ? 1 : 0);
        const nextGraded = graded + (wasGraded ? 1 : 0);
        const next = index + 1;
        if (next < queue.length) {
          setPhase({
            kind: 'review',
            queue,
            index: next,
            correct: nextCorrect,
            graded: nextGraded,
          });
        } else {
          setPhase({ kind: 'done', correct: nextCorrect, total: nextGraded });
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  emoji: { fontSize: 48 },
});
