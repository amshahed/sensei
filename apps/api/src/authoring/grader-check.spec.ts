import {
  loadGraderCases,
  loadOpenCheckCases,
  RUNS_PER_CASE,
  runGraderCheck,
  runOpenCheckCases,
  type GraderCase,
  type OpenCheckCase,
  type OpenCheckDraft,
} from './grader-check';
import type { OpenGradeResult } from '../grading/grading.service';
import type { RecallableItem } from '../recall/recall-question';

const row: RecallableItem = {
  type: 'GRAMMAR',
  display: 'か',
  reading: null,
  meaning: 'question marker',
  data: {},
};
const rows = new Map([['g1', row]]);
const accepted: GraderCase = { itemId: 'g1', answer: 'x', expect: 'accepted' };
const result = (over: Partial<OpenGradeResult>): OpenGradeResult => ({
  rating: 'Good',
  correct: true,
  feedback: '',
  exemplar: '',
  gradedBy: 'ai',
  scored: true,
  ...over,
});
const grader = (...replies: Array<Partial<OpenGradeResult>>) => {
  const gradeOpen = jest.fn();
  for (const r of replies) gradeOpen.mockResolvedValueOnce(result(r));
  return { gradeOpen };
};

describe('runGraderCheck', () => {
  it('runs each case three times against the question and exemplar', async () => {
    const g = grader({}, {}, {});
    const [outcome] = await runGraderCheck([accepted], rows, g);
    expect(RUNS_PER_CASE).toBe(3);
    expect(g.gradeOpen).toHaveBeenCalledTimes(3);
    expect(g.gradeOpen).toHaveBeenCalledWith({
      prompt: 'What does 「か」 mean?',
      answer: 'x',
      exemplar: 'question marker',
    });
    expect(outcome.pass).toBe(true);
  });

  it('accepts a Hard, because Hard is still correct', async () => {
    const [o] = await runGraderCheck(
      [accepted],
      rows,
      grader({ rating: 'Hard' }, { rating: 'Hard' }, {}),
    );
    expect(o.pass).toBe(true);
  });

  it('fails when any one run disagrees', async () => {
    const [o] = await runGraderCheck(
      [accepted],
      rows,
      grader({}, { rating: 'Again', correct: false }, {}),
    );
    expect(o.pass).toBe(false);
    expect(o.reason).toMatch(/expected accepted/);
  });

  it('passes a rejected case only if every run rejects it', async () => {
    const wrong = { rating: 'Again' as const, correct: false };
    const [o] = await runGraderCheck(
      [{ ...accepted, expect: 'rejected' }],
      rows,
      grader(wrong, wrong, wrong),
    );
    expect(o.pass).toBe(true);
  });

  it('fails a fallback result, even one that agrees: it could not be evaluated', async () => {
    const wrong = {
      rating: 'Again' as const,
      correct: false,
      gradedBy: 'fallback' as const,
    };
    const [o] = await runGraderCheck(
      [{ ...accepted, expect: 'rejected' }],
      rows,
      grader(wrong, wrong, wrong),
    );
    expect(o.pass).toBe(false);
    expect(o.reason).toMatch(/could not be evaluated/);
  });

  it('fails an item with no question, without calling the grader', async () => {
    const g = grader();
    const [o] = await runGraderCheck(
      [{ ...accepted, itemId: 'missing' }],
      rows,
      g,
    );
    expect(o.pass).toBe(false);
    expect(g.gradeOpen).not.toHaveBeenCalled();
  });
});

describe('the committed cases', () => {
  const cases = loadGraderCases();

  it('covers 5 different phrases', () => {
    const phrases = cases.filter((c) => c.itemId.startsWith('ja:vocab:'));
    expect(new Set(phrases.map((c) => c.itemId)).size).toBe(5);
    expect(phrases).toHaveLength(5);
  });

  it('holds the 8 grammar cases from the content review, with か rejected', () => {
    const grammar = cases.filter((c) => c.itemId.startsWith('ja:grammar:'));
    expect(
      grammar.map((c) => [c.itemId.split(':')[2], c.answer, c.expect]),
    ).toEqual([
      ['です', 'is', 'accepted'],
      ['も', 'too', 'accepted'],
      ['に', 'at', 'accepted'],
      ['に', 'to', 'accepted'],
      ['を', 'object particle', 'accepted'],
      ['て-form', 'connects verbs', 'accepted'],
      ['ませんか', 'do you want to', 'accepted'],
      ['か', 'because', 'rejected'],
    ]);
  });
});

describe('runOpenCheckCases (B.2.d)', () => {
  const question = {
    id: 'q17',
    targetItemId: 'ja:grammar:です',
    prompt: 'Write your own self-introduction.',
    answerType: 'typed' as const,
    correctAnswer: 'はじめまして。サム です。',
    grading: 'open' as const,
    rubric: 'Pass any introduction that gives a name.',
  };
  const draft: OpenCheckDraft = {
    lessonId: 'l-120',
    check: {
      questions: [
        { ...question, id: 'q1', grading: undefined, rubric: undefined },
        question,
      ],
    },
  };
  const intro: OpenCheckCase = {
    lessonId: 'l-120',
    checkId: 'q17',
    name: 'full, kana',
    answer: 'はじめまして。サム です。',
    expect: 'accepted',
  };
  const wrong = { rating: 'Again' as const, correct: false };

  it('grades three times with the draft prompt, model answer and rubric', async () => {
    const g = grader({}, {}, {});
    const [o] = await runOpenCheckCases([intro], draft, g);
    expect(g.gradeOpen).toHaveBeenCalledTimes(RUNS_PER_CASE);
    expect(g.gradeOpen).toHaveBeenCalledWith({
      prompt: 'Write your own self-introduction.',
      answer: 'はじめまして。サム です。',
      exemplar: 'はじめまして。サム です。',
      rubric: 'Pass any introduction that gives a name.',
    });
    expect(o.pass).toBe(true);
  });

  it('skips cases for another lesson', async () => {
    const g = grader();
    const outcomes = await runOpenCheckCases(
      [{ ...intro, lessonId: 'other' }],
      draft,
      g,
    );
    expect(outcomes).toEqual([]);
    expect(g.gradeOpen).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', 'q99'],
    ['closed', 'q1'],
  ])('fails a case whose check is %s, without grading', async (_how, id) => {
    const g = grader();
    const [o] = await runOpenCheckCases([{ ...intro, checkId: id }], draft, g);
    expect(o.pass).toBe(false);
    expect(o.reason).toMatch(/no open check/);
    expect(g.gradeOpen).not.toHaveBeenCalled();
  });

  it('fails when one run disagrees with what is wanted', async () => {
    const [o] = await runOpenCheckCases([intro], draft, grader({}, wrong, {}));
    expect(o.pass).toBe(false);
    expect(o.reason).toMatch(/expected accepted/);
  });

  it('fails a fallback, even one that agrees', async () => {
    const fallback = { ...wrong, gradedBy: 'fallback' as const };
    const [o] = await runOpenCheckCases(
      [{ ...intro, expect: 'rejected' }],
      draft,
      grader(fallback, fallback, fallback),
    );
    expect(o.pass).toBe(false);
    expect(o.reason).toMatch(/could not be evaluated/);
  });

  it('fails a kana-only case when any comment holds kanji', async () => {
    const [o] = await runOpenCheckCases(
      [{ ...intro, kanaFeedback: true }],
      draft,
      grader(
        { feedback: 'Nice; add where you are from, like カナダじん です.' },
        { feedback: 'Nice; next time add your 名前.' },
        {},
      ),
    );
    expect(o.pass).toBe(false);
    expect(o.reason).toMatch(/kanji/);
  });

  it('allows kanji in the comment when the case does not forbid it', async () => {
    const [o] = await runOpenCheckCases(
      [intro],
      draft,
      grader({ feedback: 'Nice 名前.' }, {}, {}),
    );
    expect(o.pass).toBe(true);
  });

  it('fails every case in a pair whose verdicts differ (P5)', async () => {
    // Both cases want "accepted"; the rōmaji one misses once.
    const kana = { ...intro, pair: 'full' };
    const romaji = { ...intro, name: 'full, rōmaji', pair: 'full' };
    const other = { ...intro, name: 'unpaired' };
    const outcomes = await runOpenCheckCases(
      [kana, romaji, other],
      draft,
      grader({}, {}, {}, {}, wrong, {}, {}, {}, {}),
    );
    expect(outcomes.map((o) => [o.name, o.pass])).toEqual([
      ['full, kana', false],
      ['full, rōmaji', false],
      ['unpaired', true],
    ]);
    expect(outcomes[0].reason).toMatch(/pair "full" got different verdicts/);
    expect(outcomes[1].reason).toMatch(/expected accepted/);
  });

  it('passes a pair that agrees in every run', async () => {
    const outcomes = await runOpenCheckCases(
      [
        { ...intro, pair: 'thin' },
        { ...intro, pair: 'thin' },
      ],
      draft,
      grader({ rating: 'Hard' }, {}, {}, {}, { rating: 'Hard' }, {}),
    );
    expect(outcomes.every((o) => o.pass)).toBe(true);
  });
});

describe('the committed open-check cases (brief 4)', () => {
  const cases = loadOpenCheckCases();

  it('holds the 10 labelled answers to lesson 120 q17', () => {
    expect(cases).toHaveLength(10);
    for (const c of cases) {
      expect(c).toMatchObject({
        lessonId: 'foundation-ja-ch17-l07',
        checkId: 'q17',
        kanaFeedback: true,
      });
    }
    expect(new Set(cases.map((c) => c.name)).size).toBe(10);
  });

  it('expects the three non-introductions to miss and the rest to pass', () => {
    expect(
      cases.filter((c) => c.expect === 'rejected').map((c) => c.name),
    ).toEqual(['English only', 'single word', 'gibberish']);
  });

  it('pairs the same introduction across scripts (P5)', () => {
    const pair = (name: string) =>
      cases.filter((c) => c.pair === name).map((c) => c.name);
    expect(pair('full')).toEqual(['full, kana', 'full, rōmaji', 'full, mix']);
    expect(pair('thin')).toEqual([
      'greeting, name, closing, rōmaji',
      'greeting, name, closing, kana',
    ]);
  });
});
