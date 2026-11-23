/**
 * Generators for specs that pass a `random` to `shuffle` (common/shuffle.ts),
 * so an order can be pinned or a distribution counted without flaking.
 */

/** Seeded mulberry32 in [0, 1): repeatable, and uniform enough to count slots. */
export function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Every Fisher–Yates swap is with itself, so the order is kept. */
export const keepOrder = (): number => 0.999999;

/**
 * Makes one `shuffle` of `n` items come out reversed, and repeats for the next
 * shuffle of `n`. Fisher–Yates draws for i = n-1 … 1 and swaps slot i with
 * floor(r·(i+1)); reversing swaps slot i with n-1-i until the two meet.
 */
export function reversing(n: number): () => number {
  const draws: number[] = [];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.min(n - 1 - i, i);
    draws.push((j + 0.5) / (i + 1));
  }
  let k = 0;
  return () => draws[k++ % draws.length];
}
