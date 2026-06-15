import { isN5Kanji, buildKanjiItem, Kd2Character } from './kanji';

const makeChar = (
  jlptLevel: number | undefined,
  literal = '日',
): Kd2Character => ({
  literal,
  misc: {
    strokeCounts: [4],
    jlptLevel,
    grade: 1,
    frequency: 1,
  },
  readingMeaning: {
    groups: [
      {
        readings: [
          { type: 'ja_on', value: 'ニチ' },
          { type: 'ja_on', value: 'ジツ' },
          { type: 'ja_kun', value: 'ひ' },
          { type: 'ja_kun', value: 'か' },
        ],
        meanings: [
          { lang: 'en', value: 'day' },
          { lang: 'en', value: 'sun' },
          { lang: 'fr', value: 'jour' },
        ],
      },
    ],
  },
});

describe('isN5Kanji', () => {
  it('accepts jlptLevel 5', () => {
    expect(isN5Kanji(makeChar(5))).toBe(true);
  });

  it('rejects jlptLevel 4 and lower', () => {
    expect(isN5Kanji(makeChar(4))).toBe(false);
    expect(isN5Kanji(makeChar(1))).toBe(false);
  });

  it('rejects undefined jlptLevel', () => {
    expect(isN5Kanji(makeChar(undefined))).toBe(false);
  });
});

describe('buildKanjiItem', () => {
  it('maps a kanjidic2 character to Item shape', () => {
    const char = makeChar(5, '日');
    const item = buildKanjiItem(char);

    expect(item).toMatchObject({
      id: 'ja:kanji:日',
      language: 'ja',
      type: 'KANJI',
      display: '日',
      reading: 'ひ',
      meaning: 'day',
    });
  });

  it('populates data with readings and meanings (en only)', () => {
    const char = makeChar(5, '日');
    const item = buildKanjiItem(char);
    const data = item.data;

    expect(data.on_readings).toEqual(['ニチ', 'ジツ']);
    expect(data.kun_readings).toEqual(['ひ', 'か']);
    expect(data.meanings).toEqual(['day', 'sun']); // 'jour' filtered out (fr)
    expect(data.stroke_count).toBe(4);
    expect(data.jlpt).toBe('N5');
  });

  it('falls back to on-reading when no kun-reading', () => {
    const char: Kd2Character = {
      literal: '玉',
      misc: { strokeCounts: [5], jlptLevel: 5 },
      readingMeaning: {
        groups: [
          {
            readings: [{ type: 'ja_on', value: 'ギョク' }],
            meanings: [{ lang: 'en', value: 'ball' }],
          },
        ],
      },
    };
    const item = buildKanjiItem(char);
    expect(item.reading).toBe('ギョク');
  });

  it('handles missing readingMeaning gracefully', () => {
    const char: Kd2Character = {
      literal: '？',
      misc: { strokeCounts: [1], jlptLevel: 5 },
    };
    const item = buildKanjiItem(char);
    expect(item.reading).toBeNull();
    expect(item.meaning).toBeNull();
    expect((item.data as { on_readings: string[] }).on_readings).toEqual([]);
  });
});
