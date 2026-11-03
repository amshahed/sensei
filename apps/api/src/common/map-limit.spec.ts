import { mapLimit } from './map-limit';

describe('mapLimit', () => {
  it('keeps order and never exceeds the limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapLimit([5, 1, 4, 2, 3], 2, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, n));
      inFlight--;
      return n * 10;
    });
    expect(out).toEqual([50, 10, 40, 20, 30]);
    expect(peak).toBe(2);
  });

  it('handles empty input', async () => {
    await expect(mapLimit([], 3, () => Promise.resolve(1))).resolves.toEqual(
      [],
    );
  });
});
