import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { CheckDto, CheckResultDto, LessonDetailDto } from '@sensei/types';
import { api } from '../api';
import { PrimaryButton, Screen, ui } from '../ui';
import { parseTeachBlocks, type TeachBlock } from './teach';

/**
 * The tracer-bullet lesson player (M.4). Drives one lesson end-to-end through
 * every system: fetches the lesson, renders the authored Teach beat, runs a
 * light Practice recap, then the graded Check beat (server-side grading +
 * FSRS write-back, #6), and finally records completion. Real runtime-AI
 * Practice + fuzzy grading arrive in #8.
 */
type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'teach'; lesson: LessonDetailDto }
  | { kind: 'practice'; lesson: LessonDetailDto }
  | { kind: 'check'; lesson: LessonDetailDto; index: number }
  | { kind: 'done'; lesson: LessonDetailDto; correct: number; total: number };

export function LessonPlayer({
  slug,
  onExit,
}: {
  slug: string;
  onExit?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [score, setScore] = useState(0);

  useEffect(() => {
    let active = true;
    api
      .getLesson(slug)
      .then((lesson) => active && setPhase({ kind: 'teach', lesson }))
      .catch((e) => active && setPhase({ kind: 'error', message: String(e) }));
    return () => {
      active = false;
    };
  }, [slug]);

  if (phase.kind === 'loading') {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
        <Text style={ui.hint}>Loading lesson…</Text>
      </View>
    );
  }

  if (phase.kind === 'error') {
    return (
      <View style={ui.center}>
        <Text style={ui.err}>Couldn’t load the lesson</Text>
        <Text style={ui.hint}>{phase.message}</Text>
        {onExit ? <PrimaryButton label="Back" onPress={onExit} /> : null}
      </View>
    );
  }

  if (phase.kind === 'teach') {
    return (
      <TeachBeat
        lesson={phase.lesson}
        onContinue={() => setPhase({ kind: 'practice', lesson: phase.lesson })}
      />
    );
  }

  if (phase.kind === 'practice') {
    return (
      <PracticeBeat
        lesson={phase.lesson}
        onContinue={() => {
          setScore(0);
          // A lesson with no checks (e.g. an authored stub) skips straight to
          // the summary instead of indexing into an empty array.
          setPhase(
            phase.lesson.checks.length === 0
              ? { kind: 'done', lesson: phase.lesson, correct: 0, total: 0 }
              : { kind: 'check', lesson: phase.lesson, index: 0 },
          );
        }}
      />
    );
  }

  if (phase.kind === 'check') {
    const { lesson, index } = phase;
    const check = lesson.checks[index];
    // Defensive: if the index ever runs past the array, end gracefully rather
    // than dereferencing undefined.
    if (!check) {
      return (
        <DoneScreen
          correct={score}
          total={lesson.checks.length}
          onExit={onExit}
        />
      );
    }
    return (
      <CheckBeat
        key={check.id}
        check={check}
        index={index}
        total={lesson.checks.length}
        onNext={(correct) => {
          const nextScore = score + (correct ? 1 : 0);
          setScore(nextScore);
          const next = index + 1;
          if (next < lesson.checks.length) {
            setPhase({ kind: 'check', lesson, index: next });
          } else {
            void api.completeLesson(lesson.slug).catch(() => undefined);
            setPhase({
              kind: 'done',
              lesson,
              correct: nextScore,
              total: lesson.checks.length,
            });
          }
        }}
      />
    );
  }

  return (
    <DoneScreen correct={phase.correct} total={phase.total} onExit={onExit} />
  );
}

/* ---------------- Beats ---------------- */

function TeachBeat({
  lesson,
  onContinue,
}: {
  lesson: LessonDetailDto;
  onContinue: () => void;
}) {
  const blocks = parseTeachBlocks(lesson.teach);
  return (
    <Screen footer={<PrimaryButton label="Practice →" onPress={onContinue} />}>
      <Text style={ui.kicker}>{lesson.chapter.title}</Text>
      <Text style={ui.title}>{lesson.title}</Text>
      {blocks.map((b, i) => (
        <TeachBlockView key={i} block={b} />
      ))}
    </Screen>
  );
}

function TeachBlockView({ block }: { block: TeachBlock }) {
  if (block.kind === 'heading') {
    return <Text style={styles.heading}>{block.text}</Text>;
  }
  if (block.kind === 'text') {
    return <Text style={ui.body}>{block.text}</Text>;
  }
  return (
    <View style={styles.kanaRow}>
      <Text style={styles.kanaChar}>{block.char}</Text>
      <View style={styles.kanaMeta}>
        <Text style={styles.kanaRomaji}>{block.romaji}</Text>
        {block.hint ? <Text style={ui.hint}>{block.hint}</Text> : null}
      </View>
    </View>
  );
}

function PracticeBeat({
  lesson,
  onContinue,
}: {
  lesson: LessonDetailDto;
  onContinue: () => void;
}) {
  return (
    <Screen
      footer={<PrimaryButton label="Start check →" onPress={onContinue} />}
    >
      <Text style={ui.kicker}>Practice</Text>
      <Text style={ui.title}>Quick recap</Text>
      <Text style={ui.body}>
        Tap each card to recall its sound before the check.
      </Text>
      {lesson.items.map((item) => (
        <RecallCard
          key={item.id}
          front={item.display}
          back={item.reading ?? ''}
        />
      ))}
    </Screen>
  );
}

function RecallCard({ front, back }: { front: string; back: string }) {
  const [shown, setShown] = useState(false);
  return (
    <Pressable style={styles.recallCard} onPress={() => setShown((s) => !s)}>
      <Text style={styles.kanaChar}>{front}</Text>
      <Text style={styles.kanaRomaji}>{shown ? back : 'tap'}</Text>
    </Pressable>
  );
}

function CheckBeat({
  check,
  index,
  total,
  onNext,
}: {
  check: CheckDto;
  index: number;
  total: number;
  onNext: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<CheckResultDto | null>(null);
  const [grading, setGrading] = useState(false);
  const [failed, setFailed] = useState(false);

  const choices = check.choices ?? [];
  const isMultipleChoice = choices.length > 0;

  async function submit(answer: string) {
    if (result || grading || answer.trim().length === 0) return;
    if (isMultipleChoice) setSelected(answer);
    setGrading(true);
    setFailed(false);
    try {
      const r = await api.gradeCheck(check.id, answer);
      setResult(r);
    } catch {
      // Don't score a network blip as a wrong answer — let the learner retry.
      setFailed(true);
    } finally {
      setGrading(false);
    }
  }

  const lastAnswer = isMultipleChoice ? (selected ?? '') : typed;
  const footer = result ? (
    <PrimaryButton
      label={index + 1 < total ? 'Next →' : 'Finish'}
      onPress={() => onNext(result.correct)}
    />
  ) : failed ? (
    <PrimaryButton label="Retry" onPress={() => submit(lastAnswer)} />
  ) : !isMultipleChoice ? (
    <PrimaryButton
      label="Check"
      onPress={() => submit(typed)}
      disabled={grading || typed.trim().length === 0}
    />
  ) : null;

  return (
    <Screen footer={footer}>
      <Text style={ui.kicker}>
        Check {index + 1} of {total}
      </Text>
      <Text style={ui.title}>{check.prompt}</Text>

      {isMultipleChoice ? (
        choices.map((choice) => {
          const isSelected = selected === choice;
          const isAnswer = result?.correctAnswer === choice;
          const stateStyle = result
            ? isAnswer
              ? styles.choiceCorrect
              : isSelected
                ? styles.choiceWrong
                : styles.choiceDim
            : null;
          return (
            <Pressable
              key={choice}
              disabled={!!result || grading}
              style={[styles.choice, stateStyle]}
              onPress={() => submit(choice)}
            >
              <Text style={styles.choiceText}>{choice}</Text>
            </Pressable>
          );
        })
      ) : (
        <TextInput
          style={styles.input}
          value={typed}
          editable={!result && !grading}
          onChangeText={setTyped}
          onSubmitEditing={() => submit(typed)}
          placeholder="Type your answer"
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}

      {failed ? (
        <Text style={ui.err}>Couldn’t reach the grader — tap Retry.</Text>
      ) : null}

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

function DoneScreen({
  correct,
  total,
  onExit,
}: {
  correct: number;
  total: number;
  onExit?: () => void;
}) {
  return (
    <View style={ui.center}>
      <Text style={styles.celebrate}>🎉</Text>
      <Text style={ui.title}>Lesson complete</Text>
      <Text style={ui.body}>
        {total === 0
          ? 'Nice work — you finished the lesson.'
          : `You got ${correct} of ${total} right.`}
      </Text>
      {onExit ? <PrimaryButton label="Back to home" onPress={onExit} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: '600', marginTop: 8 },
  kanaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  kanaMeta: { gap: 2 },
  kanaChar: { fontSize: 40, fontWeight: '600' },
  kanaRomaji: { fontSize: 16, color: '#555' },
  recallCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f5f5f7',
  },
  choice: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  choiceText: { fontSize: 22 },
  choiceCorrect: { backgroundColor: '#E6F4EA', borderColor: '#0E8A16' },
  choiceWrong: { backgroundColor: '#FBE9E7', borderColor: '#B60205' },
  choiceDim: { opacity: 0.5 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
  },
  celebrate: { fontSize: 48 },
});
