import { keepOrder, mulberry32, reversing } from '../testing/random';
import { shuffle } from './shuffle';

describe('shuffle (B.2.f)', () => {
  it('returns a permutation of its input, in place', () => {
    const arr = ['a', 'b', 'c', 'd', 'e'];
    const out = shuffle(arr, mulberry32(1));
    expect(out).toBe(arr);
    expect([...out].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('keeps the order when every draw picks the last slot', () => {
    expect(shuffle(['a', 'b', 'c', 'd'], keepOrder)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('reverses with the reversing generator the specs use', () => {
    expect(shuffle(['a', 'b', 'c'], reversing(3))).toEqual(['c', 'b', 'a']);
    expect(shuffle(['a', 'b', 'c', 'd'], reversing(4))).toEqual([
      'd',
      'c',
      'b',
      'a',
    ]);
  });

  it('handles empty and single-element arrays', () => {
    expect(shuffle([], mulberry32(2))).toEqual([]);
    expect(shuffle(['a'], mulberry32(2))).toEqual(['a']);
  });

  it('puts each of four options in each slot about equally often', () => {
    const random = mulberry32(20261123);
    const options = ['a', 'b', 'c', 'd'];
    const counts = new Map(options.map((o) => [o, [0, 0, 0, 0]]));
    for (let run = 0; run < 8000; run++) {
      shuffle([...options], random).forEach((o, slot) => {
        counts.get(o)![slot]++;
      });
    }
    // Expected 2,000 per cell; ±200 is about 5σ (σ ≈ 38.7).
    for (const slots of counts.values()) {
      for (const n of slots) {
        expect(n).toBeGreaterThanOrEqual(1800);
        expect(n).toBeLessThanOrEqual(2200);
      }
    }
  });
});
