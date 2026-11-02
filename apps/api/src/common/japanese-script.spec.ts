import { hasKanji, isKanaOnly } from './japanese-script';

describe('japanese-script', () => {
  it('hasKanji covers 々, 〆 and CJK Extension A', () => {
    for (const s of ['人々', '〆切', '㐂', '居る', '猫']) {
      expect([s, hasKanji(s)]).toEqual([s, true]);
    }
    for (const s of ['これ', 'コーヒー', 'abc', '']) {
      expect([s, hasKanji(s)]).toEqual([s, false]);
    }
  });

  it('isKanaOnly accepts hiragana, katakana and ー only', () => {
    expect(isKanaOnly('コーヒー')).toBe(true);
    expect(isKanaOnly('これ')).toBe(true);
    expect(isKanaOnly('居る')).toBe(false);
    expect(isKanaOnly('')).toBe(false);
  });
});
