import {
  loadGraderCases,
  RUNS_PER_CASE,
  runGraderCheck,
  type GraderCase,
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
