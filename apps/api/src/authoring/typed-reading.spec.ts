import { toRomaji } from 'wanakana';
import { WritingEvalService } from '../writing-eval/writing-eval.service';
import { courseContextFor, type CourseContext } from './course-context';
import { checkCourseRules, TYPED_READING_PROMPT } from './course-rules';
import type { CheckQuestion, LessonDraft } from './lesson-schema';
import { compile, loadOutlineSpec, outlineItemIds } from './outline-compiler';
import type { OutlineItemRow } from './outline-compiler';
import { addTypedReadingChecks } from './typed-reading';

const spec = loadOutlineSpec();
const rows: OutlineItemRow[] = outlineItemIds(spec).map((id) => {
  const kind = id.split(':')[1];
  const surface = spec.surfaces[id] ?? id.split(':')[2];
  return {
    id,
    type: kind.toUpperCase() as OutlineItemRow['type'],
    display: surface,
    reading: kind === 'grammar' ? null : surface,
  };
});
const skeleton = compile(spec, rows);
const lessons = skeleton.module.chapters.flatMap((c) => c.lessons);
const ctxAt = (n: number): CourseContext =>
  courseContextFor(skeleton, lessons[n - 1].id)!;
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
      explanation: `${first.surface} is read "${toRomaji(first.surface)}".`,
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

  it.each(targets)('lesson %i: %s', (_n, surface) => {
    expect(svc.exactMatch(toRomaji(surface), surface)).toBe(true);
  });
});
