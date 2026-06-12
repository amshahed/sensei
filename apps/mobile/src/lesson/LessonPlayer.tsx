import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { CheckDto, CheckResultDto, LessonDetailDto } from '@sensei/types';
import { api } from '../api';
import { parseTeachBlocks, type TeachBlock } from './teach';

/**
 * The tracer-bullet lesson player (M.4). Drives one lesson end-to-end through
 * every system: fetches the lesson, renders the authored Teach beat, runs a
 * light Practice recap, then the graded Check beat (server-side grading), and
 * finally records completion. Real runtime-AI Practice arrives in #8; mastery
 * updates on completion in #6.
 */
type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'teach'; lesson: LessonDetailDto }
  | { kind: 'practice'; lesson: LessonDetailDto }
  | { kind: 'check'; lesson: LessonDetailDto; index: number }
  | { kind: 'done'; lesson: LessonDetailDto; correct: number; total: number };

export function LessonPlayer({ slug }: { slug: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [score, setScore] = useState(0);

  useEffect(() => {
    let active = true;
    api
      .getLesson(slug)
      .then((lesson) => active && setPhase({ kind: 'teach', lesson }))
      .catch(
        (e) => active && setPhase({ kind: 'error', message: String(e) }),
      );
    return () => {
      active = false;
    };
  }, [slug]);

  if (phase.kind === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.hint}>Loading lesson…</Text>
      </View>
    );
  }

  if (phase.kind === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>Couldn’t load the lesson</Text>
        <Text style={styles.hint}>{phase.message}</Text>
      </View>
    );
  }

  if (phase.kind === 'teach') {
    return (
      <TeachBeat
        lesson={phase.lesson}
        onContinue={() =>
          setPhase({ kind: 'practice', lesson: phase.lesson })
        }
      />
    );
  }

  if (phase.kind === 'practice') {
    return (
      <PracticeBeat
        lesson={phase.lesson}
        onContinue={() => {
          setScore(0);
          setPhase({ kind: 'check', lesson: phase.lesson, index: 0 });
        }}
      />
    );
  }

  if (phase.kind === 'check') {
    const { lesson, index } = phase;
    const check = lesson.checks[index];
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

  return <DoneScreen correct={phase.correct} total={phase.total} />;
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
      <Text style={styles.kicker}>{lesson.chapter.title}</Text>
      <Text style={styles.title}>{lesson.title}</Text>
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
    return <Text style={styles.body}>{block.text}</Text>;
  }
  return (
    <View style={styles.kanaRow}>
      <Text style={styles.kanaChar}>{block.char}</Text>
      <View style={styles.kanaMeta}>
        <Text style={styles.kanaRomaji}>{block.romaji}</Text>
        {block.hint ? <Text style={styles.hint}>{block.hint}</Text> : null}
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
    <Screen footer={<PrimaryButton label="Start check →" onPress={onContinue} />}>
      <Text style={styles.kicker}>Practice</Text>
      <Text style={styles.title}>Quick recap</Text>
      <Text style={styles.body}>
        Tap each card to recall its sound before the check.
      </Text>
      {lesson.items.map((item) => (
        <RecallCard key={item.id} front={item.display} back={item.reading ?? ''} />
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
  const [result, setResult] = useState<CheckResultDto | null>(null);
  const [grading, setGrading] = useState(false);

  async function submit(answer: string) {
    if (result || grading) return;
    setSelected(answer);
    setGrading(true);
    try {
      const r = await api.gradeCheck(check.id, answer);
      setResult(r);
    } catch {
      // Surface a soft failure rather than blocking the lesson.
      setResult({ checkId: check.id, correct: false, correctAnswer: '' });
    } finally {
      setGrading(false);
    }
  }

  const choices = check.choices ?? [];
  return (
    <Screen
      footer={
        result ? (
          <PrimaryButton
            label={index + 1 < total ? 'Next →' : 'Finish'}
            onPress={() => onNext(result.correct)}
          />
        ) : null
      }
    >
      <Text style={styles.kicker}>
        Check {index + 1} of {total}
      </Text>
      <Text style={styles.title}>{check.prompt}</Text>

      {choices.map((choice) => {
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
      })}

      {result ? (
        <Text style={result.correct ? styles.ok : styles.err}>
          {result.correct
            ? 'Correct!'
            : `Answer: ${result.correctAnswer || '—'}`}
        </Text>
      ) : null}
    </Screen>
  );
}

function DoneScreen({ correct, total }: { correct: number; total: number }) {
  return (
    <View style={styles.center}>
      <Text style={styles.celebrate}>🎉</Text>
      <Text style={styles.title}>Lesson complete</Text>
      <Text style={styles.body}>
        You got {correct} of {total} right.
      </Text>
    </View>
  );
}

/* ---------------- Shared UI ---------------- */

function Screen({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>{children}</ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 24, gap: 12, paddingBottom: 24 },
  center: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
  },
  kicker: { fontSize: 13, color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '600', marginTop: 8 },
  body: { fontSize: 16, lineHeight: 22, color: '#333' },
  hint: { fontSize: 13, color: '#999' },
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
  ok: { fontSize: 16, color: '#0E8A16', fontWeight: '600' },
  err: { fontSize: 15, color: '#B60205', fontWeight: '600' },
  celebrate: { fontSize: 48 },
  button: {
    backgroundColor: '#111',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
