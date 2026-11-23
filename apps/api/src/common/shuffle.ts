/**
 * In-place Fisher–Yates shuffle: every permutation equally likely when
 * `random` is uniform on [0, 1). Returns `arr` itself, so pass a copy to keep
 * the original (`shuffle([...xs], random)`). Use it for a lesson's options and
 * for any new place that orders what a learner is asked (B.2.f), never
 * `sort(() => random() - 0.5)`, which is biased. Placement predates it: its
 * `withAnswer` puts the answer in a uniform random slot, pinned by its spec.
 */
export function shuffle<T>(arr: T[], random: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
