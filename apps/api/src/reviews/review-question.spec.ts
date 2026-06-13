import { reviewQuestionFor, type ReviewableItem } from './review-question';

const base: ReviewableItem = {
  type: 'KANA',
  display: 'あ',
  reading: 'あ',
  meaning: null,
  data: { romaji: 'a' },
};

describe('reviewQuestionFor', () => {
  it('asks kana for rōmaji from data', () => {
    const q = reviewQuestionFor(base);
    expect(q.expectedAnswer).toBe('a');
    expect(q.prompt).toContain('あ');
  });

  it('falls back to reading when kana has no rōmaji', () => {
    const q = reviewQuestionFor({ ...base, data: {} });
    expect(q.expectedAnswer).toBe('あ');
  });

  it('asks vocab/kanji for the reading', () => {
    const q = reviewQuestionFor({
      type: 'VOCAB',
      display: '猫',
      reading: 'ねこ',
      meaning: 'cat',
      data: {},
    });
    expect(q.expectedAnswer).toBe('ねこ');
  });

  it('asks grammar for the meaning', () => {
    const q = reviewQuestionFor({
      type: 'GRAMMAR',
      display: 'です',
      reading: null,
      meaning: 'to be (polite copula)',
      data: {},
    });
    expect(q.expectedAnswer).toBe('to be (polite copula)');
  });
});
