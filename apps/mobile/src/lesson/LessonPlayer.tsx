import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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

/**
 * How one check ended. "ungraded" is an open check the grader couldn't judge:
 * it counts neither way, so it is left out of the score (B.2.d, P6).
 */
type CheckOutcome = 'right' | 'wrong' | 'ungraded';

/** An absent `scored` (an API from before B.2.d) reads as judged, as it was. */
function outcomeOf(result: CheckResultDto): CheckOutcome {
  if (result.scored === false) return 'ungraded';
  return result.correct ? 'right' : 'wrong';
}

/** The end-of-lesson score: an ungraded check counts neither way (P6). */
function tally(outcomes: CheckOutcome[], checks: number) {
  return {
    correct: outcomes.filter((o) => o === 'right').length,
    total: checks - outcomes.filter((o) => o === 'ungraded').length,
  };
}

export function LessonPlayer({
  slug,
  onExit,
}: {
  slug: string;
  onExit?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [outcomes, setOutcomes] = useState<CheckOutcome[]>([]);

  // Fetch once per showing, and never refetch on focus or foreground: the API
  // shuffles multiple-choice options per request, so a refetch would move
  // them on screen (B.2.e).
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
          setOutcomes([]);
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
          slug={lesson.slug}
          {...tally(outcomes, lesson.checks.length)}
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
        onNext={(outcome) => {
          const nextOutcomes = [...outcomes, outcome];
          setOutcomes(nextOutcomes);
          const next = index + 1;
          if (next < lesson.checks.length) {
            setPhase({ kind: 'check', lesson, index: next });
          } else {
            setPhase({
              kind: 'done',
              lesson,
              // "X of 16" when one of 17 couldn't be graded (P6).
              ...tally(nextOutcomes, lesson.checks.length),
            });
          }
        }}
      />
    );
  }

  return (
    <DoneScreen
      slug={phase.lesson.slug}
      correct={phase.correct}
      total={phase.total}
      onExit={onExit}
    />
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
  if (block.kind === 'passage') {
    return (
      <View style={styles.passage}>
        {block.title ? (
          <Text style={styles.passageTitle}>{block.title}</Text>
        ) : null}
        <Text style={styles.passageText}>{block.text}</Text>
      </View>
    );
  }
  if (block.kind === 'example') {
    return (
      <View style={styles.example}>
        <Text style={styles.exampleJP}>{block.japanese}</Text>
        <Text style={styles.exampleReading}>{block.reading}</Text>
        <Text style={styles.exampleTranslation}>{block.translation}</Text>
      </View>
    );
  }
  if (block.kind === 'mnemonic') {
    return (
      <View style={styles.mnemonic}>
        <Text style={styles.mnemonicLabel}>💡 Tip</Text>
        <Text style={ui.body}>{block.text}</Text>
      </View>
    );
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
        Tap each card to test yourself before the check.
      </Text>
      {lesson.items.map((item) =>
        item.recap ? (
          <RecallCard key={item.id} front={item.display} back={item.recap} />
        ) : null,
      )}
    </Screen>
  );
}

function RecallCard({ front, back }: { front: string; back: string }) {
  const [shown, setShown] = useState(false);
  return (
    <Pressable style={styles.recallCard} onPress={() => setShown((s) => !s)}>
      <Text
        style={styles.recallFront}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {front}
      </Text>
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
  onNext: (outcome: CheckOutcome) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [guessed, setGuessed] = useState(false);
  const [result, setResult] = useState<CheckResultDto | null>(null);
  const [grading, setGrading] = useState(false);
  const [failed, setFailed] = useState(false);

  const choices = check.choices ?? [];
  const isMultipleChoice = choices.length > 0;
  // Free writing, such as a self-introduction (B.2.d): a box that shows the
  // whole answer, and a result that frames the model answer as an example.
  const isOpen = check.open === true && !isMultipleChoice;

  async function submit(answer: string) {
    if (result || grading || answer.trim().length === 0) return;
    if (isMultipleChoice) setSelected(answer);
    setGrading(true);
    setFailed(false);
    try {
      // The guess flag only applies to multiple-choice (K.1).
      const r = await api.gradeCheck(
        check.id,
        answer,
        isMultipleChoice && guessed,
      );
      // The keyboard would cover the result in the footer. The typed answer
      // stays in the box, so the learner can compare it.
      Keyboard.dismiss();
      setResult(r);
    } catch {
      // Don't score a network blip as a wrong answer — let the learner retry.
      setFailed(true);
    } finally {
      setGrading(false);
    }
  }

  const lastAnswer = isMultipleChoice ? (selected ?? '') : typed;
  // The result sits in the pinned footer, above Next, so it is in view without
  // scrolling however long the question is (B.2.b).
  const footer = result ? (
    <View style={styles.resultFooter}>
      <ResultPanel result={result} open={isOpen} />
      <PrimaryButton
        label={index + 1 < total ? 'Next →' : 'Finish'}
        onPress={() => onNext(outcomeOf(result))}
      />
    </View>
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
    <Screen footer={footer} avoidKeyboard={isOpen}>
      <Text style={ui.kicker}>
        Check {index + 1} of {total}
      </Text>
      <Text style={ui.title}>{check.prompt}</Text>

      {isMultipleChoice ? (
        <Pressable
          disabled={!!result || grading}
          style={[styles.guessToggle, guessed && styles.guessToggleOn]}
          onPress={() => setGuessed((g) => !g)}
        >
          <Text style={guessed ? styles.guessTextOn : styles.guessText}>
            {guessed ? '☑' : '☐'} I guessed
          </Text>
        </Pressable>
      ) : null}

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
      ) : isOpen ? (
        // Grows with the text, so the screen scrolls rather than the box, and
        // Return is a new line: only Check sends it, never half an answer.
        <TextInput
          style={[styles.input, styles.inputOpen]}
          value={typed}
          editable={!result && !grading}
          onChangeText={setTyped}
          multiline
          scrollEnabled={false}
          textAlignVertical="top"
          placeholder="Type your answer"
          autoCapitalize="none"
          autoCorrect={false}
        />
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
    </Screen>
  );
}

/**
 * What a check tells the learner once it is graded (B.2.a): the verdict, then
 * the right answer if they missed, in kana with its rōmaji under it when the
 * server sends both, then the explanation. A check with no explanation shows
 * nothing in its place. Text is never truncated. The panel never takes more
 * than about half the screen, so Next stays on screen and the question keeps
 * room: real results fit well inside that, and only an extreme one (a long
 * model answer at a large text size) scrolls within the panel.
 *
 * An open check (B.2.d) shows the verdict, then the grader's comment on what
 * the learner wrote, so both are the first lines in view. On a miss the model
 * answer follows as one example, never "Answer:". When the grader couldn't
 * judge, a plain notice replaces the verdict, with no red or green, and the
 * example still follows so the check still teaches.
 */
function ResultPanel({
  result,
  open,
}: {
  result: CheckResultDto;
  open: boolean;
}) {
  const { height } = useWindowDimensions();
  const forms = result.correct ? undefined : result.answerForms;
  const ungraded = outcomeOf(result) === 'ungraded';
  const missedOrUngraded = ungraded || !result.correct;
  return (
    <ScrollView
      style={{ maxHeight: height * RESULT_MAX_SHARE }}
      contentContainerStyle={styles.result}
      bounces={false}
    >
      {ungraded ? (
        <Text style={styles.resultUngraded}>
          Couldn’t grade this right now, so it doesn’t count.
        </Text>
      ) : (
        <Text style={result.correct ? ui.ok : ui.err}>
          {result.correct ? 'Correct!' : 'Not quite.'}
        </Text>
      )}
      {result.feedback ? (
        <Text style={styles.resultComment}>{result.feedback}</Text>
      ) : null}
      {open ? (
        missedOrUngraded && result.correctAnswer ? (
          <>
            <Text style={styles.exampleLabel}>One way to write it:</Text>
            <Text style={styles.resultExample}>{result.correctAnswer}</Text>
          </>
        ) : null
      ) : (
        <>
          {result.correct ? null : (
            <Text style={styles.resultAnswer}>
              Answer: {forms?.kana ?? (result.correctAnswer || '—')}
            </Text>
          )}
          {forms ? (
            <Text style={styles.resultRomaji}>{forms.romaji}</Text>
          ) : null}
        </>
      )}
      {result.explanation ? (
        <Text style={ui.body}>{result.explanation}</Text>
      ) : null}
    </ScrollView>
  );
}

/** The most of the window the result panel may take (B.2.b, P2). */
const RESULT_MAX_SHARE = 0.45;

/**
 * End of lesson. Owns the completion write, which is what advances the
 * curriculum (the outline and Home's "Continue" read it), so every path that
 * reaches here records it, including lessons with no checks. Leaving waits for
 * the write; a failure is shown with Retry rather than silently dropped.
 */
function DoneScreen({
  slug,
  correct,
  total,
  onExit,
}: {
  slug: string;
  correct: number;
  total: number;
  onExit?: () => void;
}) {
  const [save, setSave] = useState<'saving' | 'saved' | 'failed'>('saving');

  const complete = useCallback(() => {
    let active = true;
    setSave('saving');
    api
      .completeLesson(slug)
      .then(() => active && setSave('saved'))
      .catch(() => active && setSave('failed'));
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(complete, [complete]);

  return (
    <View style={ui.center}>
      <Text style={styles.celebrate}>🎉</Text>
      <Text style={ui.title}>Lesson complete</Text>
      <Text style={ui.body}>
        {total === 0
          ? 'Nice work — you finished the lesson.'
          : `You got ${correct} of ${total} right.`}
      </Text>
      {save === 'failed' ? (
        <>
          <Text style={ui.err}>Couldn’t save your progress.</Text>
          <PrimaryButton label="Retry" onPress={complete} />
          {onExit ? (
            <Pressable onPress={onExit} accessibilityRole="button">
              <Text style={ui.hint}>Leave without saving</Text>
            </Pressable>
          ) : null}
        </>
      ) : onExit ? (
        <PrimaryButton
          label={save === 'saving' ? 'Saving…' : 'Done'}
          onPress={onExit}
          disabled={save === 'saving'}
        />
      ) : null}
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
  recallFront: { fontSize: 40, fontWeight: '600' },
  recallCard: {
    gap: 6,
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
  guessToggle: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  guessToggleOn: { backgroundColor: '#FFF4E5', borderColor: '#E8A33D' },
  guessText: { fontSize: 14, color: '#888' },
  guessTextOn: { fontSize: 14, color: '#B26A00', fontWeight: '600' },
  resultFooter: { gap: 12 },
  result: { gap: 4 },
  resultAnswer: { fontSize: 17, fontWeight: '600', color: '#111' },
  resultRomaji: { fontSize: 16, color: '#555' },
  resultUngraded: { fontSize: 16, color: '#555', fontWeight: '600' },
  resultComment: { fontSize: 16, lineHeight: 22, color: '#111' },
  exampleLabel: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
    marginTop: 4,
  },
  resultExample: { fontSize: 16, lineHeight: 24, color: '#111' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
  },
  // About six short lines of writing before it grows (P7).
  inputOpen: { minHeight: 150, paddingTop: 14 },
  passage: {
    backgroundColor: '#F7F7FA',
    borderLeftWidth: 3,
    borderLeftColor: '#4A6CF7',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  passageTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A6CF7',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  passageText: { fontSize: 17, lineHeight: 26 },
  example: {
    backgroundColor: '#F0F4FF',
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  exampleJP: { fontSize: 22, fontWeight: '600' },
  exampleReading: { fontSize: 14, color: '#555' },
  exampleTranslation: { fontSize: 15, color: '#333', fontStyle: 'italic' },
  mnemonic: {
    backgroundColor: '#FFFBEA',
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  mnemonicLabel: { fontSize: 13, fontWeight: '600', color: '#8A6914' },
  celebrate: { fontSize: 48 },
});
