import {
  type AssessmentVerdict,
  assessmentVerdict,
} from './assessment-verdict';

describe('assessmentVerdict (I.4.d.b)', () => {
  const BAR = 0.8;
  /** 80% exactly, in integers: an oracle independent of the float tolerance. */
  const meetsBar = (n: number, asked: number) => 5 * n >= 4 * asked;

  /** Every `(right, ungraded, asked)` a test of up to 20 questions can give. */
  const cases: { right: number; ungraded: number; asked: number }[] = [];
  for (let asked = 1; asked <= 20; asked++) {
    for (let right = 0; right <= asked; right++) {
      for (let ungraded = 0; right + ungraded <= asked; ungraded++) {
        cases.push({ right, ungraded, asked });
      }
    }
  }
  const verdict = (c: { right: number; ungraded: number; asked: number }) =>
    assessmentVerdict(c, BAR);

  it('V1: matches every way the ungraded answers could have come out', () => {
    for (const c of cases) {
      // k of the ungraded answers right, for every k.
      const outcomes = Array.from({ length: c.ungraded + 1 }, (_, k) =>
        meetsBar(c.right + k, c.asked),
      );
      const expected: AssessmentVerdict = outcomes.every(Boolean)
        ? 'PASSED'
        : outcomes.some(Boolean)
          ? 'UNDECIDED'
          : 'FAILED';
      expect({ ...c, verdict: verdict(c) }).toEqual({
        ...c,
        verdict: expected,
      });
    }
  });

  it('V2: the score shown (graded answers only) always agrees with a verdict', () => {
    for (const c of cases) {
      const v = verdict(c);
      if (v === 'UNDECIDED') continue;
      const graded = c.asked - c.ungraded;
      expect({ ...c, graded: graded >= 1 }).toEqual({ ...c, graded: true });
      expect({ ...c, v, shownPass: meetsBar(c.right, graded) }).toEqual({
        ...c,
        v,
        shownPass: v === 'PASSED',
      });
    }
  });

  it('V3: with every answer graded, it is the plain 80% bar and never undecided', () => {
    for (const c of cases.filter((x) => x.ungraded === 0)) {
      expect({ ...c, verdict: verdict(c) }).toEqual({
        ...c,
        verdict: meetsBar(c.right, c.asked) ? 'PASSED' : 'FAILED',
      });
    }
  });

  it.each([
    [1, 19, 20, 'UNDECIDED'], // the F1 repro: 1 right, 19 ungraded
    [16, 4, 20, 'PASSED'],
    [15, 4, 20, 'UNDECIDED'],
    [12, 4, 20, 'UNDECIDED'],
    [11, 4, 20, 'FAILED'],
    [10, 4, 20, 'FAILED'],
    [13, 4, 20, 'UNDECIDED'], // 80% graded, 13 of 16 shown: still not a pass
    [3, 1, 4, 'UNDECIDED'],
    [1, 1, 2, 'UNDECIDED'],
    [16, 0, 20, 'PASSED'],
    [15, 0, 20, 'FAILED'],
  ] as const)(
    '(%i right, %i ungraded, of %i) is %s',
    (right, ungraded, asked, v) => {
      expect(verdict({ right, ungraded, asked })).toBe(v);
    },
  );

  it('throws when no question could be asked', () => {
    expect(() => verdict({ right: 0, ungraded: 0, asked: 0 })).toThrow(
      RangeError,
    );
  });
});
