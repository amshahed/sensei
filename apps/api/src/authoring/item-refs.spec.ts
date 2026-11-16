import { compiledOutline } from '../testing/compiled-outline';
import { repointUndeclaredTargets } from './item-refs';
import type { CheckQuestion, LessonDraft } from './lesson-schema';

const { lessons, ctxAt } = compiledOutline();

/** Lesson n's draft with one typed check on `targetItemId`. */
function draftAt(
  n: number,
  check: Partial<CheckQuestion> & { targetItemId: string },
): LessonDraft {
  const lesson = lessons[n - 1];
  return {
    lessonId: lesson.id,
    lessonType: lesson.type,
    title: lesson.title,
    targetItemIds: lesson.itemIds,
    teach: { blocks: [{ type: 'text', text: 'x' }] },
    practice: {
      templates: [{ targetItemId: lesson.itemIds[0], mode: 'recognition' }],
    },
    check: {
      questions: [
        {
          id: 'q1',
          targetItemId: lesson.itemIds[0],
          prompt: 'Which?',
          answerType: 'multiple-choice',
          choices: ['a', 'b', 'c', 'd'],
          correctAnswer: 'a',
          explanation: 'x',
        },
        {
          id: 'q2',
          prompt: 'Your friend hands you a gift. What do you say?',
          answerType: 'typed',
          correctAnswer: 'x',
          explanation: 'x',
          ...check,
        },
      ],
    },
    meta: {
      generatedAt: new Date().toISOString(),
      model: 'm',
      tokenUsage: { inputTokens: 0, outputTokens: 0 },
    },
  };
}

describe('repointUndeclaredTargets (F.2.h)', () => {
  it('repoints lesson 22: the answer is exactly one declared phrase', () => {
    const draft = draftAt(22, {
      targetItemId: 'ja:vocab:ありがotou',
      correctAnswer: 'ありがとう',
    });
    const result = repointUndeclaredTargets(draft, ctxAt(22));
    // Not ありがとうございます, which only starts the same way.
    expect(result.draft.check.questions[1].targetItemId).toBe(
      'ja:vocab:ありがとう',
    );
    expect(result.repointed).toEqual([
      {
        questionId: 'q2',
        from: 'ja:vocab:ありがotou',
        to: 'ja:vocab:ありがとう',
      },
    ]);
    // Pure: the draft passed in keeps its garbled id.
    expect(draft.check.questions[1].targetItemId).toBe('ja:vocab:ありがotou');
  });

  it('repoints lesson 25, comparing the answer as the grader does', () => {
    const draft = draftAt(25, {
      targetItemId: 'ja:vocab:ごちosさまでした',
      correctAnswer: 'ごちそうさま でした。',
    });
    const { draft: fixed } = repointUndeclaredTargets(draft, ctxAt(25));
    expect(fixed.check.questions[1].targetItemId).toBe(
      'ja:vocab:ごちそうさまでした',
    );
  });

  it('leaves a check alone when two declared targets share the answer', () => {
    const ctx = ctxAt(22);
    const twice = {
      ...ctx,
      targets: [
        ...ctx.targets,
        { id: 'ja:vocab:有り難う', surface: 'ありがとう' },
      ],
    };
    const draft = draftAt(22, {
      targetItemId: 'ja:vocab:ありがotou',
      correctAnswer: 'ありがとう',
    });
    draft.targetItemIds = [...draft.targetItemIds, 'ja:vocab:有り難う'];
    const result = repointUndeclaredTargets(draft, twice);
    expect(result.repointed).toEqual([]);
    expect(result.draft).toBe(draft);
  });

  it('leaves a check alone when its answer is English', () => {
    const draft = draftAt(22, {
      targetItemId: 'ja:vocab:ありがotou',
      correctAnswer: 'thank you',
    });
    expect(repointUndeclaredTargets(draft, ctxAt(22)).repointed).toEqual([]);
  });

  it('never moves a check on a declared target, even to a better match', () => {
    const draft = draftAt(22, {
      targetItemId: 'ja:vocab:すみません',
      correctAnswer: 'ありがとう',
    });
    expect(repointUndeclaredTargets(draft, ctxAt(22)).draft).toBe(draft);
  });
});
