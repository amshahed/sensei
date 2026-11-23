import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { PrismaClient } from '@prisma/client';
import {
  isN5Kanji,
  toModernJlpt,
  buildKanjiItem,
  diffKanjiRows,
  ingestKanji,
  Kd2Character,
} from './kanji';
import { loadKanjiSupplement, type KanjiSupplement } from './supplement';

// Real records (日 old-JLPT 4, 同 old-JLPT 3, 鬱 none, 校 and 食 old-JLPT 4)
// from jmdict-simplified kanjidic2-en-3.6.2. KANJIDIC2 uses the pre-2010 1–4
// scale — there is no 5.
const [NICHI, DOU, UTSU, KOU, SHOKU] = JSON.parse(
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

  it('takes jlpt from the old-scale mapping, not a hardcoded N5', () => {
    expect(buildKanjiItem(DOU).data.jlpt).toBe('N4'); // old level 3
    expect(buildKanjiItem(UTSU).data.jlpt).toBeNull(); // unlevelled
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

describe('buildKanjiItem with the kanji supplement (G.4.g, P1, P2)', () => {
  const supplement = (over: Partial<KanjiSupplement>): KanjiSupplement => ({
    meanings: {},
    words: {},
    ...over,
  });

  it('shows 校 as the sense its lesson teaches, and KANJIDIC2 first without it', () => {
    expect(buildKanjiItem(KOU).meaning).toBe('exam');
    const item = buildKanjiItem(
      KOU,
      supplement({ meanings: { 校: 'school' } }),
    );
    expect(item.meaning).toBe('school');
    // The full sense list is still KANJIDIC2's, in its order.
    expect(item.data.meanings).toEqual(buildKanjiItem(KOU).data.meanings);
  });

  it("refuses a meaning that is not one of the character's KANJIDIC2 senses", () => {
    expect(() =>
      buildKanjiItem(KOU, supplement({ meanings: { 校: 'college' } })),
    ).toThrow(/"college" isn't a KANJIDIC2 sense of 校/);
  });

  it('records the verb a kanji is taught in, leaving its reading column alone', () => {
    const item = buildKanjiItem(
      SHOKU,
      supplement({ words: { 食: 'た.べる' } }),
    );
    expect(item.data.word_reading).toBe('た.べる');
    expect(item.reading).toBe(buildKanjiItem(SHOKU).reading);
    expect(item.data.kun_readings).toContain('た.べる');
  });

  it('refuses a word reading that is not a kun reading, or has no okurigana', () => {
    expect(() =>
      buildKanjiItem(SHOKU, supplement({ words: { 食: 'た.べます' } })),
    ).toThrow(/isn't a KANJIDIC2 kun reading of 食/);
    expect(() =>
      buildKanjiItem(NICHI, supplement({ words: { 日: 'ひ' } })),
    ).toThrow(/with okurigana/);
  });

  it('adds no key to a kanji the supplement does not name, so its row is unchanged', () => {
    const full = supplement({
      meanings: { 校: 'school' },
      words: { 食: 'た.べる' },
    });
    expect(buildKanjiItem(NICHI, full)).toEqual(buildKanjiItem(NICHI));
    expect(buildKanjiItem(KOU)).not.toHaveProperty('data.word_reading');
  });

  it('the committed supplement holds 校 and the eight verb kanji, and fits the real records', () => {
    const committed = loadKanjiSupplement();
    expect(committed.meanings).toEqual({ 校: 'school' });
    expect(Object.keys(committed.words).sort()).toEqual(
      [...'食飲読書行来見聞'].sort(),
    );
    expect(buildKanjiItem(KOU, committed).meaning).toBe('school');
    expect(buildKanjiItem(SHOKU, committed).data.word_reading).toBe('た.べる');
  });
});

describe('ingestKanji with the supplement', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kanji-'));
  const source = path.join(dir, 'kanjidic2.json');
  fs.writeFileSync(
    source,
    JSON.stringify({ characters: [NICHI, DOU, UTSU, KOU, SHOKU] }),
  );
  const supplement: KanjiSupplement = {
    meanings: { 校: 'school' },
    words: { 食: 'た.べる' },
  };

  function fakeDb(stored: ReturnType<typeof buildKanjiItem>[]) {
    const upsert = jest.fn().mockResolvedValue({});
    const findMany = jest.fn(({ where }: { where: { id: { in: string[] } } }) =>
      Promise.resolve(stored.filter((row) => where.id.in.includes(row.id))),
    );
    const prisma = { item: { upsert, findMany } } as unknown as PrismaClient;
    return { prisma, upsert, findMany };
  }

  let log: jest.SpyInstance;
  beforeEach(() => {
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => log.mockRestore());

  /** The rows as they are stored today: the ingest without the supplement. */
  const today = [NICHI, KOU, SHOKU].map((c) => buildKanjiItem(c));

  it('upserts every N5 kanji with the supplement applied', async () => {
    const db = fakeDb(today);
    await ingestKanji(db.prisma, source, { supplement });
    const written = db.upsert.mock.calls.map(
      ([arg]: [{ where: { id: string }; update: { meaning: string } }]) => [
        arg.where.id,
        arg.update.meaning,
      ],
    );
    expect(written).toEqual([
      ['ja:kanji:日', 'day'],
      ['ja:kanji:校', 'school'],
      ['ja:kanji:食', 'eat'],
    ]);
  });

  it('dry run: prints only the changed fields, and writes nothing', async () => {
    const db = fakeDb(today);
    await ingestKanji(db.prisma, source, { supplement, dryRun: true });
    expect(db.upsert).not.toHaveBeenCalled();
    expect(log.mock.calls.map(([line]) => line as string)).toEqual([
      'ja:kanji:校  meaning: "exam" → "school"',
      'ja:kanji:食  data.word_reading: (absent) → "た.べる"',
      'ingest:items kanji --dry-run — 2 of 3 N5 kanji rows would change; nothing written',
    ]);
  });

  it('refuses a supplement that names a character outside the N5 set, before writing', async () => {
    const db = fakeDb(today);
    await expect(
      ingestKanji(db.prisma, source, {
        supplement: { meanings: { 同: 'same' }, words: { 鬱: 'うっ.する' } },
      }),
    ).rejects.toThrow(
      /2 character\(s\) that aren't N5 kanji in this file: 同 鬱/,
    );
    expect(db.upsert).not.toHaveBeenCalled();
  });
});

describe('diffKanjiRows', () => {
  const item = buildKanjiItem(NICHI);

  it('is empty when the stored row matches, whatever its data key order', () => {
    const reordered = {
      ...item,
      data: Object.fromEntries(Object.entries(item.data).reverse()),
    };
    expect(diffKanjiRows([item], [reordered])).toEqual([]);
  });

  it('names a new row, a changed column and a changed data key', () => {
    expect(diffKanjiRows([item], [])).toEqual(['ja:kanji:日  new row']);
    const stored = {
      ...item,
      reading: 'ニチ',
      data: { ...item.data, stroke_count: 5, extra: true },
    };
    expect(diffKanjiRows([item], [stored])).toEqual([
      'ja:kanji:日  reading: "ニチ" → "ひ"',
      'ja:kanji:日  data.stroke_count: 5 → 4',
      'ja:kanji:日  data.extra: true → (absent)',
    ]);
  });
});
