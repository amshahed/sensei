import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type {
  PracticeItemDto,
  PracticeResultDto,
  PracticeStartRequest,
} from '@sensei/types';
import { api } from '../api';
import { RecallCard } from '../recall/RecallCard';
import { PrimaryButton, ui } from '../ui';

/** A queued card; `repeat` = a miss brought back once at the end (exposure only). */
interface Entry {
  item: PracticeItemDto;
  repeat: boolean;
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | { kind: 'drill'; sessionId: string; queue: Entry[]; index: number }
  | { kind: 'done' };

/**
 * One Practice drill (J.1): weakest-first items from the chosen scope, typed
 * recall with review-style immediate feedback (J.1.d). Misses come back once
 * at the end — the server counts only the first answer per item toward FSRS
 * (J.1.c), so the repeat is exposure only. No end-of-session score report.
 */
export function PracticeSession({
  request,
  title,
  onExit,
}: {
  request: PracticeStartRequest;
  title: string;
  onExit: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  // Bumped by "Practice again" to start a fresh session (new weakest-first pick).
  const [round, setRound] = useState(0);

  useEffect(() => {
    let active = true;
    setPhase({ kind: 'loading' });
    api
      .startPractice(request)
      .then(({ sessionId, items }) => {
        if (!active) return;
        setPhase(
          sessionId && items.length > 0
            ? {
                kind: 'drill',
                sessionId,
                queue: items.map((item) => ({ item, repeat: false })),
                index: 0,
              }
            : { kind: 'empty' },
        );
      })
      .catch(
        (e: unknown) =>
          active && setPhase({ kind: 'error', message: String(e) }),
      );
    return () => {
      active = false;
    };
  }, [request, round]);

  if (phase.kind === 'loading') {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
        <Text style={ui.hint}>Picking your weakest items…</Text>
      </View>
    );
  }
  if (phase.kind === 'error') {
    return (
      <View style={ui.center}>
        <Text style={ui.err}>Couldn’t start practice</Text>
        <Text style={ui.hint}>{phase.message}</Text>
        <PrimaryButton label="Retry" onPress={() => setRound((r) => r + 1)} />
        <PrimaryButton label="Back" onPress={onExit} />
      </View>
    );
  }
  if (phase.kind === 'empty') {
    return (
      <View style={ui.center}>
        <Text style={ui.title}>Nothing to practise here yet</Text>
        <Text style={[ui.body, styles.centered]}>
          Items show up for practice once you’ve learned them in a lesson.
        </Text>
        <PrimaryButton label="Back" onPress={onExit} />
      </View>
    );
  }
  if (phase.kind === 'done') {
    return (
      <View style={ui.center}>
        <Text style={styles.emoji}>💪</Text>
        <Text style={ui.title}>Practice done</Text>
        <Text style={[ui.body, styles.centered]}>
          Your answers have updated your review schedule.
        </Text>
        <PrimaryButton
          label="Practice again"
          onPress={() => setRound((r) => r + 1)}
        />
        <PrimaryButton label="Back to practice" onPress={onExit} />
      </View>
    );
  }

  const { sessionId, queue, index } = phase;
  const { item, repeat } = queue[index];
  // A real (scored) miss comes back once at the end, for exposure.
  const requeues = (r: PracticeResultDto | null) =>
    !repeat && !!r && r.scored && !r.correct;
  return (
    <RecallCard<PracticeResultDto>
      key={`${index}:${item.itemId}`}
      kicker={`${title} · ${index + 1} of ${queue.length}${repeat ? ' · again' : ''}`}
      display={item.display}
      prompt={item.prompt}
      last={(r) => index + 1 >= queue.length && !requeues(r)}
      grade={(answer) => api.answerPractice(sessionId, item.itemId, answer)}
      note={(r) =>
        r.scored && !r.counted
          ? 'Practice only — this item already counted this session.'
          : null
      }
      onNext={(r) => {
        const nextQueue = requeues(r)
          ? [...queue, { item, repeat: true }]
          : queue;
        const next = index + 1;
        setPhase(
          next < nextQueue.length
            ? { kind: 'drill', sessionId, queue: nextQueue, index: next }
            : { kind: 'done' },
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  emoji: { fontSize: 48 },
  centered: { textAlign: 'center' },
});
