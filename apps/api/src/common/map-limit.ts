/**
 * `Promise.all(items.map(fn))` with at most `limit` calls in flight — for
 * fan-outs to rate-limited services (LLM grading) or a small DB pool. Results
 * keep input order; the first rejection rejects the whole call.
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, worker),
  );
  return out;
}
