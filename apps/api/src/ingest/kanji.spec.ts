import * as fs from 'fs';
import * as path from 'path';
import { isN5Kanji, toModernJlpt, buildKanjiItem, Kd2Character } from './kanji';

// Real records (日 old-JLPT 4, 同 old-JLPT 3, 鬱 none) from jmdict-simplified
// kanjidic2-en-3.6.2. KANJIDIC2 uses the pre-2010 1–4 scale — there is no 5.
const [NICHI, DOU, UTSU] = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '__fixtures__/kanjidic2-real-sample.json'),
    'utf-8',
  ),
) as Kd2Character[];

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

describe('toModernJlpt', () => {
  it('maps old 4 → N5 and old 3 → N4; nothing else', () => {
    expect(toModernJlpt(4)).toBe('N5');
    expect(toModernJlpt(3)).toBe('N4');
    expect(toModernJlpt(2)).toBeUndefined();
    expect(toModernJlpt(5)).toBeUndefined(); // does not exist in KANJIDIC2
    expect(toModernJlpt(null)).toBeUndefined();
    expect(toModernJlpt(undefined)).toBeUndefined();
  });
});

describe('isN5Kanji (real KANJIDIC2 records)', () => {
  it('accepts an old-level-4 kanji', () => {
    expect(NICHI.misc.jlptLevel).toBe(4);
    expect(isN5Kanji(NICHI)).toBe(true);
  });

  it('rejects old level 3 and unlevelled kanji', () => {
    expect(isN5Kanji(DOU)).toBe(false);
    expect(isN5Kanji(UTSU)).toBe(false);
  });
});

describe('buildKanjiItem', () => {
  it('maps a real kanjidic2 character to Item shape', () => {
    const item = buildKanjiItem(NICHI);

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
    const char = makeChar(4, '日');
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
      misc: { strokeCounts: [5], jlptLevel: 4 },
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
      misc: { strokeCounts: [1], jlptLevel: 4 },
    };
    const item = buildKanjiItem(char);
    expect(item.reading).toBeNull();
    expect(item.meaning).toBeNull();
    expect((item.data as { on_readings: string[] }).on_readings).toEqual([]);
  });
});
