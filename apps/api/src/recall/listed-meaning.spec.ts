import { isListedMeaning } from './listed-meaning';

// Stored meanings verbatim from the live lessons (2026-11-28).
const KONNICHIWA = 'hello; good day; good afternoon';
const ARIGATOU = 'thank you; thanks';
const SUMIMASEN = "excuse me; pardon me; I'm sorry; I beg your pardon";
const HAJIMEMASHITE =
  "nice to meet you; I'm glad to make your acquaintance; how do you do?";
const DOUITASHIMASHITE =
  "you're welcome; don't mention it; not at all; my pleasure";
const SAI = '... years old';
const MAN = '10,000';
const MIZU = 'water (esp. cool or cold)';
const MAE = 'in front (of)';
const AMERIKA = '(United States of) America';
const OISHII = 'good(-tasting)';
const TABERU = 'to eat';
const IKU = 'to go';
const KURU = 'to come (spatially or temporally)';
const CHOTTO = 'a little';
const TOIRE = 'toilet';
const DESU = 'Is, am, are. Ends a polite sentence saying what something is.';

describe('isListedMeaning (G.4.h)', () => {
  describe('any one listed meaning counts (P1)', () => {
    it.each([
      ['hello', KONNICHIWA],
      ['good day', KONNICHIWA],
      ['good afternoon', KONNICHIWA],
      ['thanks', ARIGATOU],
      ['thank you', ARIGATOU],
      ['excuse me', SUMIMASEN],
      ['I beg your pardon', SUMIMASEN],
      ['pen', 'pen'],
      ['a little', CHOTTO],
    ])('accepts %p for %p', (answer, meaning) => {
      expect(isListedMeaning(answer, meaning)).toBe(true);
    });
  });

  describe('case, spacing and punctuation are ignored (P2)', () => {
    it.each([
      ['Hello!', KONNICHIWA],
      ['thanks.', ARIGATOU],
      ['  THANK   you ', ARIGATOU],
      ['how do you do', HAJIMEMASHITE],
      ['years old', SAI],
      ["I'm sorry", SUMIMASEN],
      ['Im sorry', SUMIMASEN],
      ['youre welcome', DOUITASHIMASHITE],
      ['10000', MAN],
      ['10,000', MAN],
    ])('accepts %p for %p', (answer, meaning) => {
      expect(isListedMeaning(answer, meaning)).toBe(true);
    });
  });

  describe('a bracketed part may be left out or typed without brackets (P3)', () => {
    it.each([
      ['water', MIZU],
      ['water esp cool or cold', MIZU],
      ['water (esp. cool or cold)', MIZU],
      ['in front', MAE],
      ['in front of', MAE],
      ['America', AMERIKA],
      ['United States of America', AMERIKA],
      ['good', OISHII],
      ['good-tasting', OISHII],
      ['good tasting', OISHII],
    ])('accepts %p for %p', (answer, meaning) => {
      expect(isListedMeaning(answer, meaning)).toBe(true);
    });

    it('each bracketed part is dropped or kept on its own', () => {
      const ni =
        'Marks where something is (in, at, on), when something happens (at, on), or where you are going (to).';
      expect(
        isListedMeaning(
          'marks where something is in at on when something happens or where you are going',
          ni,
        ),
      ).toBe(true);
    });
  });

  describe("a verb's leading “to” may be left out (P4)", () => {
    it.each([
      ['eat', TABERU],
      ['to eat', TABERU],
      ['go', IKU],
      ['come', KURU],
      ['to come', KURU],
      ['come spatially or temporally', KURU],
    ])('accepts %p for %p', (answer, meaning) => {
      expect(isListedMeaning(answer, meaning)).toBe(true);
    });

    it('drops "to" only as a whole word', () => {
      expect(isListedMeaning('ilet', TOIRE)).toBe(false);
      expect(isListedMeaning('toilet', TOIRE)).toBe(true);
    });

    it('"to" alone is not the verb', () => {
      expect(isListedMeaning('to', TABERU)).toBe(false);
    });
  });

  describe('everything else goes to the grader (P7)', () => {
    it.each([
      ['delicious', OISHII],
      ['a pen', 'pen'],
      ['helo', KONNICHIWA],
      ['goodbye', KONNICHIWA],
      ['little', CHOTTO],
      ['hello good day', KONNICHIWA],
      ['thank', ARIGATOU],
      ['is', DESU],
      ['is, am, are', DESU],
      ['ten thousand', MAN],
      ['ate', TABERU],
    ])('rejects %p for %p', (answer, meaning) => {
      expect(isListedMeaning(answer, meaning)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it.each(['', '   ', '?!', '...'])(
      'an answer with no letters or digits (%p) never matches',
      (answer) => {
        expect(isListedMeaning(answer, SAI)).toBe(false);
        expect(isListedMeaning(answer, '(…)')).toBe(false);
      },
    );

    it('a meaning with no letters or digits matches nothing', () => {
      expect(isListedMeaning('x', '(…)')).toBe(false);
      expect(isListedMeaning('…', '(…)')).toBe(false);
    });

    it('up to 6 bracketed parts, any mix of dropped and kept counts', () => {
      const six = 'a (b) (c) (d) (e) (f) (g)';
      expect(isListedMeaning('a', six)).toBe(true);
      expect(isListedMeaning('a b d g', six)).toBe(true);
      expect(isListedMeaning('a b c d e f g', six)).toBe(true);
    });

    it('above 6 bracketed parts, only all dropped or all kept counts', () => {
      const seven = 'a (b) (c) (d) (e) (f) (g) (h)';
      expect(isListedMeaning('a', seven)).toBe(true);
      expect(isListedMeaning('a b c d e f g h', seven)).toBe(true);
      expect(isListedMeaning('a b', seven)).toBe(false);
      expect(isListedMeaning('a b c d e f g', seven)).toBe(false);
    });
  });
});
