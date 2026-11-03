/**
 * Sample up to `size` entries spread across groups (one per lesson): lessons
 * are visited in a shuffled order, taking one random entry from each per
 * round, so a short test still touches as many lessons as possible.
 */
export function sampleAcrossGroups<T>(
  groups: readonly (readonly T[])[],
  size: number,
  random: () => number,
): T[] {
  const pools = shuffle(
    groups.filter((g) => g.length > 0).map((g) => shuffle([...g], random)),
    random,
  );
  const out: T[] = [];
  while (out.length < size && pools.some((p) => p.length > 0)) {
    for (const pool of pools) {
      if (out.length >= size) break;
      const next = pool.pop();
      if (next !== undefined) out.push(next);
    }
  }
  return out;
}

function shuffle<T>(arr: T[], random: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
