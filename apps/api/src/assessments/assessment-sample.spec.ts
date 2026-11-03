import { sampleAcrossGroups } from './assessment-sample';

describe('sampleAcrossGroups', () => {
  /** Deterministic LCG in [0, 1). */
  const rng =
    (seed = 1) =>
    () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  const groups = [
    ['a1', 'a2', 'a3'],
    ['b1', 'b2'],
    [],
    ['c1', 'c2', 'c3', 'c4'],
  ];

  it('touches every non-empty group before taking a second from any', () => {
    const out = sampleAcrossGroups(groups, 3, rng());
    expect(new Set(out.map((x) => x[0]))).toEqual(new Set(['a', 'b', 'c']));
  });

  it('returns everything (no duplicates) when size exceeds the pool', () => {
    const out = sampleAcrossGroups(groups, 50, rng(7));
    expect(out).toHaveLength(9);
    expect(new Set(out).size).toBe(9);
  });

  it('caps at size', () => {
    expect(sampleAcrossGroups(groups, 5, rng(3))).toHaveLength(5);
    expect(sampleAcrossGroups([], 5, rng())).toEqual([]);
  });
});
