import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  parseCsvLine,
  parseJlptList,
  cellVariants,
  readingVariants,
  matchJlptList,
  assignVocabIds,
  buildVocabItem,
  ingestVocab,
  DEFAULT_JLPT_LISTS,
  JmdictWord,
  JlptListRow,
} from './vocab';
import { PrismaClient } from '@prisma/client';

// Real records copied verbatim (first sense, first 2 glosses) from
// jmdict-simplified jmdict-eng-3.6.2 — NOT hand-written. The previous spec used
// invented `jlpt-n5` tags and `lang: 'en'` glosses; the real file has neither,
// so the importer passed its tests and loaded zero words.
const REAL: JmdictWord[] = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '__fixtures__/jmdict-real-sample.json'),
    'utf-8',
  ),
) as JmdictWord[];

const row = (
  expression: string,
  reading: string,
  level: 'N5' | 'N4' = 'N5',
): JlptListRow => ({ expression, reading, level });

describe('parseCsvLine', () => {
  it('splits plain and quoted cells', () => {
    expect(parseCsvLine('会う,あう')).toEqual(['会う', 'あう']);
    expect(parseCsvLine('ああ,"Ah!, Oh!"')).toEqual(['ああ', 'Ah!, Oh!']);
    expect(parseCsvLine('a,"say ""hi"""')).toEqual(['a', 'say "hi"']);
  });
});

describe('parseJlptList', () => {
  it('reads expression/reading by header and tags the level', () => {
    const rows = parseJlptList('expression,reading\n猫,ねこ\n', 'N5');
    expect(rows).toEqual([{ expression: '猫', reading: 'ねこ', level: 'N5' }]);
  });

  it('fills a blank reading from a kana-only expression', () => {
    const rows = parseJlptList('expression,reading\nかまう,\n猫,\n', 'N4');
    expect(rows.map((r) => r.reading)).toEqual(['かまう', '']);
  });

  it('rejects a file without the expected header', () => {
    expect(() => parseJlptList('foo,bar\n猫,ねこ', 'N5')).toThrow(
      'expression,reading',
    );
  });

  it('parses the committed lists (sanity: non-empty, no blank cells)', () => {
    for (const { level, file } of DEFAULT_JLPT_LISTS) {
      const rows = parseJlptList(fs.readFileSync(file, 'utf-8'), level);
      expect(rows.length).toBeGreaterThan(500);
      expect(rows.every((r) => r.expression && r.reading)).toBe(true);
    }
  });
});

describe('cellVariants / readingVariants', () => {
  it('splits alternatives', () => {
    expect(cellVariants('足; 脚')).toEqual(['足', '脚']);
    expect(cellVariants('回る、回す')).toEqual(['回る', '回す']);
  });

  it('strips counter/affix markers', () => {
    expect(cellVariants('～円')).toEqual(['円']);
  });

  it('tries an optional (parenthesised) part both ways', () => {
    expect(cellVariants('パート (タイム)')).toEqual(['パートタイム', 'パート']);
  });

  it('adds the noun reading for suru-verbs', () => {
    expect(readingVariants('うんどうする')).toEqual([
      'うんどうする',
      'うんどう',
    ]);
    // する itself is not stripped to nothing
    expect(readingVariants('する')).toEqual(['する']);
  });
});

describe('matchJlptList (real JMdict records)', () => {
  it('joins every normalisation case to the right entry', () => {
    const { matches, unmatched } = matchJlptList(REAL, [
      row('猫', 'ねこ'),
      row('これ', 'これ'),
      row('足; 脚', 'あし'),
      row('～円', '～えん'),
      row('運動', 'うんどうする', 'N4'),
      row('パート (タイム)', 'パート (タイム)', 'N4'),
    ]);
    expect(unmatched).toEqual([]);
    expect(
      matches.map((m) => [m.word.id, m.display, m.reading, m.level]),
    ).toEqual([
      ['1467640', '猫', 'ねこ', 'N5'],
      ['1628530', 'これ', 'これ', 'N5'], // list spelling, not the rare 此れ
      ['1404630', '足', 'あし', 'N5'],
      ['1175570', '円', 'えん', 'N5'],
      ['1172910', '運動', 'うんどう', 'N4'],
      ['1100830', 'パートタイム', 'パートタイム', 'N4'],
    ]);
  });

  it('matches a suru-verb written with する in the expression', () => {
    const { matches } = matchJlptList(REAL, [
      row('運動する', 'うんどうする', 'N4'),
    ]);
    expect(matches.map((m) => [m.word.id, m.display])).toEqual([
      ['1172910', '運動'],
    ]);
  });

  it('recovers a row whose columns are swapped', () => {
    const { matches, unmatched } = matchJlptList(REAL, [row('ねこ', '猫')]);
    expect(unmatched).toEqual([]);
    expect(matches[0].word.id).toBe('1467640');
  });

  it('disambiguates homographs by reading', () => {
    const { matches } = matchJlptList(REAL, [
      row('方', 'かた'),
      row('方', 'ほう'),
    ]);
    expect(matches.map((m) => m.word.id)).toEqual(['1516925', '1516930']);
  });

  it('keeps a word once, at its first (easier) level', () => {
    const { matches } = matchJlptList(REAL, [
      row('猫', 'ねこ', 'N5'),
      row('猫', 'ねこ', 'N4'),
    ]);
    expect(matches).toHaveLength(1);
    expect(matches[0].level).toBe('N5');
  });

  it('reports rows with no JMdict match instead of dropping them silently', () => {
    const { matches, unmatched } = matchJlptList(REAL, [
      row('猫', 'いぬ'), // spelling exists, reading does not
      row('存在しない', 'そんざいしない'),
    ]);
    expect(matches).toEqual([]);
    expect(unmatched).toHaveLength(2);
  });
});

describe('assignVocabIds', () => {
  it('suffixes the reading when two words share a display form', () => {
    const { matches } = matchJlptList(REAL, [
      row('方', 'かた'),
      row('方', 'ほう'),
    ]);
    const { assigned, dropped } = assignVocabIds(matches);
    expect(assigned.map((a) => a.id)).toEqual([
      'ja:vocab:方',
      'ja:vocab:方:ほう',
    ]);
    expect(dropped).toEqual([]);
  });
});

describe('buildVocabItem', () => {
  it('reads English glosses from lang "eng" (ISO 639-2)', () => {
    const { matches } = matchJlptList(REAL, [row('猫', 'ねこ')]);
    const item = buildVocabItem(matches[0], 'ja:vocab:猫');
    expect(item).toMatchObject({
      id: 'ja:vocab:猫',
      language: 'ja',
      type: 'VOCAB',
      display: '猫',
      reading: 'ねこ',
      meaning: 'cat (esp. the domestic cat, Felis catus)',
    });
    expect(item.data).toEqual({
      writing_forms: ['猫'],
      readings: ['ねこ', 'ネコ'],
      senses: ['cat (esp. the domestic cat, Felis catus)', 'feline'],
      jmdict_id: '1467640',
      jlpt: 'N5',
    });
  });

  it('limits senses to 3 glosses', () => {
    const word: JmdictWord = {
      ...REAL[0],
      sense: [
        {
          gloss: ['dog', 'canine', 'hound', 'mutt'].map((text) => ({
            lang: 'eng',
            text,
          })),
        },
      ],
    };
    const item = buildVocabItem(
      { word, level: 'N5', display: '猫', reading: 'ねこ' },
      'ja:vocab:猫',
    );
    expect(item.data.senses).toHaveLength(3);
  });
});

describe('ingestVocab', () => {
  it('upserts only list words, in list order, with ids + levels', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-'));
    const jmdictPath = path.join(tmp, 'jmdict.json');
    fs.writeFileSync(jmdictPath, JSON.stringify({ words: REAL }));
    const n5 = path.join(tmp, 'n5.csv');
    const n4 = path.join(tmp, 'n4.csv');
    fs.writeFileSync(n5, 'expression,reading\nこれ,これ\n方,かた\n方,ほう\n');
    fs.writeFileSync(n4, 'expression,reading\n運動,うんどうする\n');

    const upsert = jest.fn().mockResolvedValue({});
    const prisma = { item: { upsert } } as unknown as PrismaClient;
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    await ingestVocab(prisma, jmdictPath, [
      { level: 'N5', file: n5 },
      { level: 'N4', file: n4 },
    ]);
    log.mockRestore();

    const created = upsert.mock.calls.map(
      (c: [{ create: { id: string; data: { jlpt: string } } }]) => [
        c[0].create.id,
        c[0].create.data.jlpt,
      ],
    );
    expect(created).toEqual([
      ['ja:vocab:これ', 'N5'],
      ['ja:vocab:方', 'N5'],
      ['ja:vocab:方:ほう', 'N5'],
      ['ja:vocab:運動', 'N4'],
    ]);
  });
});
