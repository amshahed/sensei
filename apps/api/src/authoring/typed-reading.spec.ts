import { toRomaji } from 'wanakana';
import { answerRomaji } from '../common/answer-romaji';
import { WritingEvalService } from '../writing-eval/writing-eval.service';
import { compiledOutline } from '../testing/compiled-outline';
import type { CourseContext } from './course-context';
import {
  checkCourseRules,
  isFairTypedReading,
  TYPED_READING_PROMPT,
} from './course-rules';
import type { CheckQuestion, LessonDraft } from './lesson-schema';
import { addTypedReadingChecks } from './typed-reading';

const { spec, lessons, ctxAt } = compiledOutline();
const typedReadingLessons = lessons
  .map((l, i) => ({ lesson: l, n: i + 1 }))
  .filter(({ lesson }) => lesson.typedReading);

function draftAt(n: number, questions: CheckQuestion[]): LessonDraft {
  const lesson = lessons[n - 1];
  return {
    lessonId: lesson.id,
    lessonType: lesson.type,
    title: lesson.title,
    targetItemIds: lesson.itemIds,
    teach: { blocks: [{ type: 'text', text: 'Read every sound.' }] },
    practice: {
      templates: lesson.itemIds.map((id) => ({
        targetItemId: id,
        mode: 'recognition' as const,
      })),
    },
    check: { questions },
    meta: {
      generatedAt: new Date().toISOString(),
      model: 'm',
      tokenUsage: { inputTokens: 0, outputTokens: 0 },
    },
  };
}

/** Lesson 19 as drafted twice: a meaning check, then recall from English. */
function lesson19Recall(): LessonDraft {
  const questions = ctxAt(19).targets.flatMap(({ id, surface }, i) => [
    {
      id: `q${2 * i + 1}`,
      targetItemId: id,
      prompt: `Which word is it?`,
      answerType: 'multiple-choice' as const,
      choices: [surface, 'か', 'き', 'く'],
      correctAnswer: surface,
      explanation: `It is ${surface}.`,
    },
    {
      id: `q${2 * i + 2}`,
      targetItemId: id,
      prompt: `Type the kana word that means 'thing ${i}'.`,
      answerType: 'typed' as const,
      correctAnswer: surface,
      explanation: `Nice! ${surface}, with the little pause.`,
    },
  ]);
  return draftAt(19, questions);
}

const typedReadingErrors = (draft: LessonDraft, n: number) =>
  checkCourseRules(draft, ctxAt(n)).errors.filter((e) =>
    e.includes('needs a typed check'),
  );

describe('addTypedReadingChecks (F.2.b)', () => {
  it('lesson 19 is a typed-reading lesson whose recall checks fail the gate', () => {
    expect(ctxAt(19).typedReading).toBe(true);
    expect(typedReadingErrors(lesson19Recall(), 19)).toHaveLength(5);
  });

  it("rewrites lesson 19's recall checks in place, keeping id and explanation", () => {
    const before = lesson19Recall();
    const after = addTypedReadingChecks(before, ctxAt(19));
    expect(after.check.questions).toHaveLength(before.check.questions.length);
    after.check.questions.forEach((q, i) => {
      const old = before.check.questions[i];
      expect(q.id).toBe(old.id);
      expect(q.explanation).toBe(old.explanation);
      if (old.answerType === 'typed') {
        expect(q.prompt).toBe(`${TYPED_READING_PROMPT} ${old.correctAnswer}`);
      } else {
        expect(q).toEqual(old);
      }
    });
  });

  it('passes the gate after the transform, and a second run changes nothing', () => {
    const once = addTypedReadingChecks(lesson19Recall(), ctxAt(19));
    expect(checkCourseRules(once, ctxAt(19)).errors).toEqual([]);
    expect(addTypedReadingChecks(once, ctxAt(19))).toEqual(once);
  });

  it('appends a check, with a unique id, for a target with no typed check', () => {
    const draft = lesson19Recall();
    const [first] = ctxAt(19).targets;
    draft.check.questions = draft.check.questions.filter(
      (q) => !(q.targetItemId === first.id && q.answerType === 'typed'),
    );
    draft.check.questions.push({
      ...draft.check.questions[0],
      id: 'q11',
    });
    const after = addTypedReadingChecks(draft, ctxAt(19));
    const added = after.check.questions.at(-1)!;
    expect(added).toEqual({
      id: 'q12',
      targetItemId: first.id,
      prompt: `${TYPED_READING_PROMPT} ${first.surface}`,
      answerType: 'typed',
      correctAnswer: first.surface,
      explanation: `${first.surface} is read "${answerRomaji(first.surface)}".`,
    });
    const ids = after.check.questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(typedReadingErrors(after, 19)).toEqual([]);
    expect(addTypedReadingChecks(after, ctxAt(19))).toEqual(after);
  });

  it('leaves a fair check alone, whatever its wording', () => {
    const draft = draftAt(
      19,
      ctxAt(19).targets.map(({ id, surface }, i) => ({
        id: `q${i + 1}`,
        targetItemId: id,
        prompt: `How do you say ${surface}? Type it.`,
        answerType: 'typed' as const,
        correctAnswer: surface,
      })),
    );
    expect(addTypedReadingChecks(draft, ctxAt(19))).toEqual(draft);
  });

  it('does nothing in a lesson without typedReading', () => {
    expect(ctxAt(43).typedReading).toBe(false);
    const draft = draftAt(43, [
      {
        id: 'q1',
        targetItemId: lessons[42].itemIds[0],
        prompt: 'Type the word that means "is".',
        answerType: 'typed',
        correctAnswer: 'です',
      },
    ]);
    expect(addTypedReadingChecks(draft, ctxAt(43))).toBe(draft);
  });

  it('never rewrites an open typed check, and appends a reading check instead', () => {
    const [first] = ctxAt(19).targets;
    const open: CheckQuestion = {
      id: 'q1',
      targetItemId: first.id,
      prompt: 'Write a sentence using the word for school.',
      answerType: 'typed',
      correctAnswer: first.surface,
      grading: 'open',
      rubric: 'Uses the word',
    };
    const after = addTypedReadingChecks(draftAt(19, [open]), ctxAt(19));
    expect(after.check.questions[0]).toEqual(open);
    expect(
      after.check.questions.filter((q) => q.targetItemId === first.id),
    ).toHaveLength(2);
  });

  it('never rewrites a typed check whose answer is another word', () => {
    const [first, second] = ctxAt(19).targets;
    const other: CheckQuestion = {
      id: 'q1',
      targetItemId: first.id,
      prompt: "Type the word for 'together'.",
      answerType: 'typed',
      correctAnswer: second.surface,
    };
    const after = addTypedReadingChecks(draftAt(19, [other]), ctxAt(19));
    expect(after.check.questions[0]).toEqual(other);
  });

  it('appends a reading check when the only typed check asks for the meaning', () => {
    const [first] = ctxAt(19).targets;
    const meaning: CheckQuestion = {
      id: 'q1',
      targetItemId: first.id,
      prompt: `What does ${first.surface} mean? Type it in English.`,
      answerType: 'typed',
      correctAnswer: 'school',
    };
    const before = draftAt(19, [meaning]);
    expect(typedReadingErrors(before, 19).join()).toContain(first.id);
    const after = addTypedReadingChecks(before, ctxAt(19));
    expect(after.check.questions[0]).toEqual(meaning);
    expect(
      after.check.questions.filter((q) => q.targetItemId === first.id),
    ).toHaveLength(2);
    expect(typedReadingErrors(after, 19)).toEqual([]);
  });

  it('writes a prompt the gate accepts even for a short reading (いい, ii)', () => {
    const n = lessons.findIndex((l) =>
      l.itemIds.some((id) => spec.surfaces[id] === 'いい'),
    );
    const ctx: CourseContext = {
      ...ctxAt(n + 1),
      typedReading: true,
      targets: [{ id: 'ja:vocab:いい', surface: 'いい' }],
    };
    const after = addTypedReadingChecks(draftAt(n + 1, []), ctx);
    expect(after.check.questions[0].prompt).toBe(
      `${TYPED_READING_PROMPT} いい`,
    );
    expect(
      checkCourseRules(after, ctx).errors.filter((e) =>
        e.includes('needs a typed check'),
      ),
    ).toEqual([]);
    expect(addTypedReadingChecks(after, ctx)).toEqual(after);
  });

  it('explains an appended check with the rōmaji the app shows, never konnichiha (F.2.e)', () => {
    const ctx: CourseContext = {
      ...ctxAt(21),
      typedReading: true,
      targets: [{ id: 'ja:vocab:こんにちは', surface: 'こんにちは' }],
    };
    const after = addTypedReadingChecks(draftAt(21, []), ctx);
    expect(after.check.questions[0].explanation).toBe(
      'こんにちは is read "konnichiwa".',
    );
  });

  it('adds no check for a target the draft leaves out, so the gate rejects it (test.md F2)', () => {
    const ctx = ctxAt(20);
    const dropped = ctx.targets.find((t) => t.id === 'ja:vocab:写真')!;
    expect(dropped.surface).toBe('しゃしん');
    const draft = draftAt(
      20,
      ctx.targets
        .filter((t) => t !== dropped)
        .map(({ id, surface }, i) => ({
          id: `q${i + 1}`,
          targetItemId: id,
          prompt: `${TYPED_READING_PROMPT} ${surface}`,
          answerType: 'typed' as const,
          correctAnswer: surface,
        })),
    );
    draft.targetItemIds = draft.targetItemIds.filter((id) => id !== dropped.id);
    draft.practice.templates = draft.practice.templates.filter(
      (t) => t.targetItemId !== dropped.id,
    );

    const after = addTypedReadingChecks(draft, ctx);
    expect(after).toEqual(draft);
    expect(typedReadingErrors(after, 20)).toEqual([
      'ja:vocab:写真 needs a typed check showing しゃしん with no rōmaji in the prompt',
    ]);
  });

  describe('an answer with punctuation is still the word (test.md F3)', () => {
    const school = () =>
      ctxAt(19).targets.find((t) => t.surface === 'がっこう')!;
    /** Lesson 19's recall draft with q2, the typed check on がっこう, changed. */
    const withQ2 = (over: Partial<CheckQuestion>) => {
      const draft = lesson19Recall();
      const i = draft.check.questions.findIndex((q) => q.id === 'q2');
      expect(draft.check.questions[i]).toMatchObject({
        targetItemId: school().id,
        answerType: 'typed',
      });
      draft.check.questions[i] = { ...draft.check.questions[i], ...over };
      return draft;
    };
    const typedOnSchool = (draft: LessonDraft) =>
      draft.check.questions.filter(
        (q) => q.targetItemId === school().id && q.answerType === 'typed',
      );

    it('keeps a fair reading check whose answer ends in 。, and adds no second one', () => {
      const draft = withQ2({
        prompt: `${TYPED_READING_PROMPT} がっこう`,
        correctAnswer: 'がっこう。',
      });
      const [q2] = typedOnSchool(draft);
      expect(isFairTypedReading(q2, 'がっこう')).toBe(true);
      const after = addTypedReadingChecks(draft, ctxAt(19));
      expect(typedOnSchool(after)).toEqual([q2]);
      expect(typedReadingErrors(after, 19)).toEqual([]);
    });

    it('rewrites a recall check whose answer ends in 。 in place', () => {
      const draft = withQ2({ correctAnswer: 'がっこう。' });
      const after = addTypedReadingChecks(draft, ctxAt(19));
      expect(typedOnSchool(after)).toEqual([
        {
          ...typedOnSchool(draft)[0],
          prompt: `${TYPED_READING_PROMPT} がっこう`,
        },
      ]);
      expect(after.check.questions).toHaveLength(draft.check.questions.length);
    });

    it('does not take 「がっこう」 for the word, because the grader keeps the brackets', () => {
      const draft = withQ2({
        prompt: `${TYPED_READING_PROMPT} がっこう`,
        correctAnswer: '「がっこう」',
      });
      const [q2] = typedOnSchool(draft);
      expect(isFairTypedReading(q2, 'がっこう')).toBe(false);
      const after = addTypedReadingChecks(draft, ctxAt(19));
      expect(typedOnSchool(after)).toEqual([
        q2,
        expect.objectContaining({ correctAnswer: 'がっこう' }),
      ]);
      expect(typedReadingErrors(after, 19)).toEqual([]);
    });
  });

  it.each(typedReadingLessons.map(({ n }) => n))(
    'lesson %i passes the typed-reading rule from a draft with no typed checks',
    (n) => {
      const draft = draftAt(n, []);
      const after = addTypedReadingChecks(draft, ctxAt(n));
      expect(after.check.questions).toHaveLength(ctxAt(n).targets.length);
      expect(typedReadingErrors(after, n)).toEqual([]);
    },
  );
});

describe('every typed-reading target accepts its rōmaji (P4, P5)', () => {
  let svc: WritingEvalService;
  beforeAll(async () => {
    svc = new WritingEvalService();
    await svc.onModuleInit();
  }, 10_000);

  const targets = typedReadingLessons.flatMap(({ n }) =>
    ctxAt(n).targets.map((t) => [n, t.surface] as const),
  );

  it('covers the six typed-reading lessons, 15 to 20', () => {
    expect(typedReadingLessons.map(({ n }) => n)).toEqual([
      15, 16, 17, 18, 19, 20,
    ]);
    expect(targets).toHaveLength(30);
  });

  // The gate calls a check fair only if a learner typing the word is marked
  // right against its answer, so the two can't disagree on punctuation.
  it.each([
    'がっこう。',
    'がっこう！',
    'がっこう？',
    'がっこう、',
    '「がっこう」',
    'がっこう…',
    'がっこう・',
    '〜がっこう',
  ])('the gate and the grader agree on the answer %s', (answer) => {
    const check: CheckQuestion = {
      id: 'q1',
      targetItemId: 'ja:vocab:学校',
      prompt: `${TYPED_READING_PROMPT} がっこう`,
      answerType: 'typed',
      correctAnswer: answer,
    };
    expect(isFairTypedReading(check, 'がっこう')).toBe(
      svc.exactMatch('gakkou', answer),
    );
  });

  it.each(targets)('lesson %i: %s', (_n, surface) => {
    expect(svc.exactMatch(toRomaji(surface), surface)).toBe(true);
  });
});
