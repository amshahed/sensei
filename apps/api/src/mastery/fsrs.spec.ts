import { Rating } from 'ts-fsrs';
import {
  applyRating,
  emptyCard,
  masteryFromStability,
  modalityForFormat,
  ratingFromCorrect,
  ratingFromLabel,
  retrievability,
  reviveCard,
  serializeCard,
  updateBreadcrumb,
} from './fsrs';

const NOW = new Date('2026-06-13T00:00:00.000Z');

describe('fsrs helpers', () => {
  it('maps correctness to Good / Again', () => {
    expect(ratingFromCorrect(true)).toBe(Rating.Good);
    expect(ratingFromCorrect(false)).toBe(Rating.Again);
  });

  it('maps AI rating labels to FSRS ratings', () => {
    expect(ratingFromLabel('Again')).toBe(Rating.Again);
    expect(ratingFromLabel('Hard')).toBe(Rating.Hard);
    expect(ratingFromLabel('Good')).toBe(Rating.Good);
    expect(ratingFromLabel('Easy')).toBe(Rating.Easy);
    // Defensive default: an out-of-enum label must not become undefined.
    expect(ratingFromLabel('nonsense' as 'Good')).toBe(Rating.Again);
  });

  it('maps each Check format to its modality', () => {
    expect(modalityForFormat('MULTIPLE_CHOICE')).toBe('recognition');
    expect(modalityForFormat('TYPED')).toBe('recall');
    expect(modalityForFormat('SPOKEN')).toBe('production');
  });

  it('derives a saturating 0–1 mastery from stability', () => {
    expect(masteryFromStability(0)).toBe(0);
    expect(masteryFromStability(-5)).toBe(0);
    const low = masteryFromStability(2);
    const high = masteryFromStability(100);
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThan(1);
  });

  it('EWMA breadcrumb moves toward the latest outcome', () => {
    expect(updateBreadcrumb(0, true)).toBeCloseTo(0.4);
    expect(updateBreadcrumb(1, false)).toBeCloseTo(0.6);
    // Repeated passes converge toward 1.
    let b = 0;
    for (let i = 0; i < 10; i++) b = updateBreadcrumb(b, true);
    expect(b).toBeGreaterThan(0.99);
  });

  describe('scheduling transitions', () => {
    it('a Good review builds stability and schedules a future due date', () => {
      const card = applyRating(emptyCard(NOW), ratingFromCorrect(true), NOW);

      expect(card.stability).toBeGreaterThan(0);
      expect(card.reps).toBe(1);
      expect(card.due.getTime()).toBeGreaterThan(NOW.getTime());
    });

    it('a guessed (Hard) correct answer schedules sooner than a confident (Good) one', () => {
      // K.1: the "I guessed" downgrade must pull the next review in.
      const good = applyRating(emptyCard(NOW), Rating.Good, NOW);
      const hard = applyRating(emptyCard(NOW), Rating.Hard, NOW);
      expect(hard.due.getTime()).toBeLessThan(good.due.getTime());
    });

    it('a failed review schedules sooner than a passed one', () => {
      const good = applyRating(emptyCard(NOW), ratingFromCorrect(true), NOW);
      const again = applyRating(emptyCard(NOW), ratingFromCorrect(false), NOW);

      expect(again.due.getTime()).toBeLessThan(good.due.getTime());
    });

    it('round-trips a card through JSON serialization', () => {
      const card = applyRating(emptyCard(NOW), ratingFromCorrect(true), NOW);
      const revived = reviveCard(serializeCard(card));

      expect(revived).not.toBeNull();
      expect(revived!.stability).toBeCloseTo(card.stability);
      expect(revived!.due.getTime()).toBe(card.due.getTime());
    });

    it('retrievability is 1 right after review and decays over time', () => {
      const card = applyRating(emptyCard(NOW), ratingFromCorrect(true), NOW);
      const later = new Date(NOW.getTime() + 1000 * 60 * 60 * 24 * 30);

      expect(retrievability(card, NOW)).toBeCloseTo(1);
      expect(retrievability(card, later)).toBeLessThan(1);
    });

    it('reviveCard rejects empty / malformed JSON', () => {
      expect(reviveCard({})).toBeNull();
      expect(reviveCard(null)).toBeNull();
      expect(reviveCard('nope')).toBeNull();
    });
  });

  describe('massed reviews (why the Practice guardrail can be per session, J.1.f)', () => {
    const MIN = 60_000;
    /** A mature review-state card, reviewed Good on schedule a few times. */
    function matureCard() {
      let t = new Date('2026-01-01T00:00:00Z');
      let c = applyRating(emptyCard(t), Rating.Good, t);
      for (let i = 0; i < 4; i++) {
        t = new Date(c.due.getTime());
        c = applyRating(c, Rating.Good, t);
      }
      return { card: c, at: t };
    }

    it('re-answering Good minutes later does not grow stability', () => {
      const { card, at } = matureCard();
      let c = card;
      for (let i = 1; i <= 3; i++) {
        c = applyRating(c, Rating.Good, new Date(at.getTime() + i * 3 * MIN));
      }
      expect(c.stability).toBeCloseTo(card.stability, 6);
    });

    it('cramming Good right after a lapse does not rebuild the interval', () => {
      const { card } = matureCard();
      const t = new Date(card.due.getTime());
      const lapsed = applyRating(card, Rating.Again, t);
      let c = lapsed;
      for (let i = 1; i <= 4; i++) {
        c = applyRating(c, Rating.Good, new Date(t.getTime() + i * 3 * MIN));
      }
      expect(c.stability).toBeCloseTo(lapsed.stability, 6);
    });
  });
});
