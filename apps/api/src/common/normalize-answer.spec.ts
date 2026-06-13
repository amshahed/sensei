import { exactMatch, normalizeAnswer } from './normalize-answer';

describe('normalizeAnswer', () => {
  it('trims, collapses internal whitespace, and lowercases', () => {
    expect(normalizeAnswer('  Konnichiwa  ')).toBe('konnichiwa');
    expect(normalizeAnswer('a\t b   c')).toBe('a b c');
  });

  it('leaves kana/kanji untouched (no romaji folding)', () => {
    expect(normalizeAnswer('おはよう')).toBe('おはよう');
  });
});

describe('exactMatch', () => {
  it('matches under normalisation', () => {
    expect(exactMatch('  KO nnichiwa', 'ko nnichiwa')).toBe(true);
    expect(exactMatch('おはよう', 'おはよう')).toBe(true);
  });

  it('rejects genuinely different answers', () => {
    expect(exactMatch('ねこ', 'いぬ')).toBe(false);
    expect(exactMatch('', 'あ')).toBe(false);
  });
});
