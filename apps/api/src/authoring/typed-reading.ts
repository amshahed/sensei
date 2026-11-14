import { toRomaji } from 'wanakana';
import type { CourseContext } from './course-context';
import {
  isFairTypedReading,
  spaceless,
  TYPED_READING_PROMPT,
} from './course-rules';
import type { CheckQuestion, LessonDraft } from './lesson-schema';

/** The first qN after the highest one in use, so an appended id is unique. */
function nextQuestionId(questions: CheckQuestion[]): string {
  const ids = new Set(questions.map((q) => q.id));
  let n =
    Math.max(
      0,
      ...questions.map((q) => Number(/^q(\d+)$/.exec(q.id)?.[1] ?? 0)),
    ) + 1;
  while (ids.has(`q${n}`)) n++;
  return `q${n}`;
}

/**
 * F.2.b: in a typedReading lesson, the pipeline owns the reading check. For
 * each target word, in order:
 *   1. a fair typed check (the gate's own test) is left alone;
 *   2. else a closed typed check whose answer is the word gets the reading
 *      prompt in place, keeping its id, position and explanation;
 *   3. else a reading check is appended, explained with wanakana's rōmaji,
 *      which the grader always accepts.
 * Pure and idempotent: a second run changes nothing.
 */
export function addTypedReadingChecks(
  draft: LessonDraft,
  ctx: CourseContext,
): LessonDraft {
  if (!ctx.typedReading) return draft;
  const questions = [...draft.check.questions];

  for (const { id, surface } of ctx.targets) {
    if (!surface) continue;
    const prompt = `${TYPED_READING_PROMPT} ${surface}`;
    const onTarget = (q: CheckQuestion) => q.targetItemId === id;
    if (questions.some((q) => onTarget(q) && isFairTypedReading(q, surface))) {
      continue;
    }

    const recall = questions.findIndex(
      (q) =>
        onTarget(q) &&
        q.answerType === 'typed' &&
        q.grading !== 'open' &&
        spaceless(q.correctAnswer) === spaceless(surface),
    );
    if (recall !== -1) {
      questions[recall] = { ...questions[recall], prompt };
      continue;
    }

    questions.push({
      id: nextQuestionId(questions),
      targetItemId: id,
      prompt,
      answerType: 'typed',
      correctAnswer: surface,
      explanation: `${surface} is read "${toRomaji(surface)}".`,
    });
  }

  return { ...draft, check: { ...draft.check, questions } };
}
