import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  parseCsvLine,
  parseJlptList,
  cellVariants,
  readingVariants,
  glossTokens,
  matchJlptList,
  assignVocabIds,
  standardWritingForms,
  buildVocabItem,
  ingestVocab,
  DEFAULT_JLPT_LISTS,
  JmdictWord,
  JlptListRow,
} from './vocab';

// Complete real entries copied from jmdict-simplified jmdict-eng-3.6.2 — NOT
// hand-written. The first version of this spec used invented `jlpt-n5` tags and
// `lang: 'en'` glosses; the real file has neither, so the importer passed its
// tests and loaded zero words.
const REAL: JmdictWord[] = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '__fixtures__/jmdict-real-sample.json'),
    'utf-8',
  ),
) as JmdictWord[];
const word = (id: string) => REAL.find((w) => w.id === id)!;

const row = (
  expression: string,
  reading: string,
  meaning?: string,
  level: 'N5' | 'N4' = 'N5',
): JlptListRow => ({ expression, reading, meaning, level });

const pickedIds = (rows: JlptListRow[]) =>
  matchJlptList(REAL, rows).matches.map((m) => m.word.id);

describe('parseCsvLine', () => {
  it('splits plain and quoted cells', () => {
    expect(parseCsvLine('会う,あう')).toEqual(['会う', 'あう']);
    expect(parseCsvLine('ああ,"Ah!, Oh!"')).toEqual(['ああ', 'Ah!, Oh!']);
    expect(parseCsvLine('a,"say ""hi"""')).toEqual(['a', 'say "hi"']);
  });
});

describe('parseJlptList', () => {
  it('reads columns by header and tags the level', () => {
    expect(
      parseJlptList('expression,reading,meaning\n猫,ねこ,cat\n', 'N5'),
    ).toEqual([
      { expression: '猫', reading: 'ねこ', meaning: 'cat', level: 'N5' },
    ]);
  });

  it('fills a blank reading from a kana-only expression', () => {
    const rows = parseJlptList('expression,reading\nかまう,\n猫,\n', 'N4');
    expect(rows.map((r) => r.reading)).toEqual(['かまう', '']);
  });

  it('splits a row naming several words positionally (、)', () => {
    const rows = parseJlptList(
      'expression,reading,meaning\n回る、回す,まわる、まわす,"to go around"\n',
      'N4',
    );
    expect(rows.map((r) => [r.expression, r.reading])).toEqual([
      ['回る', 'まわる'],
      ['回す', 'まわす'],
    ]);
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
  });

  it('strips counter/affix markers', () => {
    expect(cellVariants('～円')).toEqual(['円']);
  });

  it('tries an optional (parenthesised) part both ways', () => {
    expect(cellVariants('パート (タイム)')).toEqual(['パートタイム', 'パート']);
  });

  it('adds the noun for suru-verbs, but never strips する itself', () => {
    expect(readingVariants('うんどうする')).toEqual([
      'うんどうする',
      'うんどう',
    ]);
    expect(readingVariants('する')).toEqual(['する']);
  });
});

describe('glossTokens', () => {
  it('keeps content words, drops stopwords, folds plurals', () => {
    expect([...glossTokens('to turn on (e.g., a light); noodles')]).toEqual([
      'turn',
      'light',
      'noodle',
    ]);
  });
});

describe('matchJlptList (real JMdict records)', () => {
  it('joins every normalisation case to the right entry', () => {
    const { matches, unmatched } = matchJlptList(REAL, [
      row('猫', 'ねこ'),
      row('これ', 'これ'),
      row('足; 脚', 'あし'),
      row('～円', '～えん'),
      row('運動', 'うんどうする', undefined, 'N4'),
      row('パート (タイム)', 'パート (タイム)', undefined, 'N4'),
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
    expect(pickedIds([row('運動する', 'うんどうする')])).toEqual(['1172910']);
  });

  it('picks the homophone the list meaning names (そば = beside, not 蕎麦)', () => {
    // The real Tanos row merges both words; the primary (pre-";") sense wins.
    expect(
      pickedIds([
        row(
          'そば',
          'そば',
          'near, close, beside; Japanese traditional buckwheat noodle',
        ),
      ]),
    ).toEqual(['1403830']);
  });

  it('prefers the specific entry over a catch-all on equal overlap (点ける, not 付ける)', () => {
    expect(
      pickedIds([
        row('つける', 'つける', 'to turn on (e.g., a light); to take'),
      ]),
    ).toEqual(['1610400']);
  });

  it('treats a row whose best match is already taken as a duplicate, not a cue to grab an unrelated word', () => {
    const report = matchJlptList(REAL, [
      row(
        '掛ける',
        'かける',
        'to put on (e.g., glasses); to hang (e.g., on a wall)',
      ),
      row('かける', 'かける', 'to dial/call (e.g., phone); to sit down'),
    ]);
    // Without the guard, row 2 grabbed 架ける "to suspend between two points".
    expect(report.matches.map((m) => m.word.id)).toEqual(['1207610']);
    expect(report.duplicates.map((r) => r.expression)).toEqual(['かける']);
  });

  it('teaches usually-kana words in kana (点ける → つける), others as listed', () => {
    const report = matchJlptList(REAL, [
      row('点ける', 'つける', 'to turn on'),
      row('猫', 'ねこ'),
    ]);
    expect(report.matches.map((m) => m.display)).toEqual(['つける', '猫']);
    expect(buildVocabItem(report.matches[0], 'x').data.writing_forms).toEqual([
      '点ける',
    ]);
  });

  it('disambiguates homographs by reading', () => {
    expect(pickedIds([row('方', 'かた'), row('方', 'ほう')])).toEqual([
      '1516925',
      '1516930',
    ]);
  });

  it('keeps a word once, at its first (easier) level', () => {
    const report = matchJlptList(REAL, [
      row('猫', 'ねこ', undefined, 'N5'),
      row('猫', 'ねこ', undefined, 'N4'),
    ]);
    expect(report.matches.map((m) => m.level)).toEqual(['N5']);
    expect(report.duplicates).toHaveLength(1);
  });

  it('recovers a row whose columns are swapped', () => {
    expect(pickedIds([row('ねこ', '猫')])).toEqual(['1467640']);
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
  const ids = (rows: JlptListRow[]) =>
    assignVocabIds(matchJlptList(REAL, rows).matches).map((a) => a.id);
  const idOf = (rows: JlptListRow[], wordId: string) =>
    assignVocabIds(matchJlptList(REAL, rows).matches).find(
      (a) => a.match.word.id === wordId,
    )?.id;

  it('qualifies EVERY word sharing a spelling, by reading', () => {
    expect(
      ids([row('方', 'かた'), row('方', 'ほう'), row('猫', 'ねこ')]),
    ).toEqual(['ja:vocab:方:かた', 'ja:vocab:方:ほう', 'ja:vocab:猫']);
  });

  it('is independent of list order — a reorder never re-points an id', () => {
    for (const rows of [
      [row('方', 'かた'), row('方', 'ほう')],
      [row('方', 'ほう'), row('方', 'かた')],
    ]) {
      expect(idOf(rows, '1516925')).toBe('ja:vocab:方:かた');
      expect(idOf(rows, '1516930')).toBe('ja:vocab:方:ほう');
    }
  });

  it('keeps an id sticky to its JMdict word across re-ingests', () => {
    // A previous run gave かた the bare id; ほう has now joined the list.
    const existing = new Map([['ja:vocab:方', '1516925']]);
    const ms = matchJlptList(REAL, [
      row('方', 'かた'),
      row('方', 'ほう'),
    ]).matches;
    expect(assignVocabIds(ms, existing).map((a) => a.id)).toEqual([
      'ja:vocab:方', // not renamed → its learners' mastery stays attached
      'ja:vocab:方:ほう',
    ]);
  });

  it('never re-points an existing id at a different word', () => {
    // The bare id belongs to ほう in the DB; the list now only has かた.
    const existing = new Map([['ja:vocab:方', '1516930']]);
    const ms = matchJlptList(REAL, [row('方', 'かた')]).matches;
    expect(assignVocabIds(ms, existing).map((a) => a.id)).toEqual([
      'ja:vocab:方:かた',
    ]);
  });

  it('qualifies kana homophones by JMdict id', () => {
    const [m] = matchJlptList(REAL, [row('そば', 'そば', 'beside')]).matches;
    const other = { ...m, word: word('1238460') }; // 蕎麦, also spelled そば
    expect(assignVocabIds([m, other]).map((a) => a.id)).toEqual([
      'ja:vocab:そば:1403830',
      'ja:vocab:そば:1238460',
    ]);
  });
});

describe('standardWritingForms', () => {
  it('drops rare / search-only kanji (これ keeps none of 此れ, 是, 之…)', () => {
    expect(standardWritingForms(word('1628530'), 'これ')).toEqual([]);
  });

  it('keeps only the kanji a reading applies to (ネコ applies to none)', () => {
    expect(standardWritingForms(word('1467640'), 'ねこ')).toEqual(['猫']);
    expect(standardWritingForms(word('1467640'), 'ネコ')).toEqual([]);
  });
});

describe('buildVocabItem', () => {
  it('reads English glosses from lang "eng" (ISO 639-2)', () => {
    const [m] = matchJlptList(REAL, [row('猫', 'ねこ')]).matches;
    const item = buildVocabItem(m, 'ja:vocab:猫');
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
      senses: [
        'cat (esp. the domestic cat, Felis catus)',
        'feline',
        'shamisen',
      ],
      jmdict_id: '1467640',
      jlpt: 'N5',
    });
  });

  it('limits senses to 3 glosses', () => {
    const [m] = matchJlptList(REAL, [
      row('つける', 'つける', 'to attach'),
    ]).matches;
    expect(buildVocabItem(m, 'x').data.senses).toHaveLength(3);
  });
});

describe('ingestVocab', () => {
  it('upserts list words with ids + levels, logs skips, retires dropped words', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-'));
    const jmdictPath = path.join(tmp, 'jmdict.json');
    fs.writeFileSync(jmdictPath, JSON.stringify({ words: REAL }));
    const n5 = path.join(tmp, 'n5.csv');
    const n4 = path.join(tmp, 'n4.csv');
    fs.writeFileSync(
      n5,
      'expression,reading,meaning\nこれ,これ,this\n方,かた,person\n方,ほう,direction\n',
    );
    fs.writeFileSync(
      n4,
      'expression,reading,meaning\n運動,うんどうする,exercise\nこれ,これ,this\n存在しない,そんざい,x\n',
    );

    const upsert = jest.fn().mockResolvedValue({});
    const update = jest.fn().mockResolvedValue({});
    // A stored word that is no longer on either list.
    const findMany = jest
      .fn()
      .mockResolvedValue([
        { id: 'ja:vocab:猫', data: { jmdict_id: '1467640', jlpt: 'N5' } },
      ]);
    const prisma = {
      item: { upsert, update, findMany },
    } as unknown as PrismaClient;
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await ingestVocab(prisma, jmdictPath, [
      { level: 'N5', file: n5 },
      { level: 'N4', file: n4 },
    ]);
    const warnings = warn.mock.calls.map((c) => String(c[0]));
    log.mockRestore();
    warn.mockRestore();

    expect(
      upsert.mock.calls.map(
        (c: [{ create: { id: string; data: { jlpt: string } } }]) => [
          c[0].create.id,
          c[0].create.data.jlpt,
        ],
      ),
    ).toEqual([
      ['ja:vocab:これ', 'N5'],
      ['ja:vocab:方:かた', 'N5'],
      ['ja:vocab:方:ほう', 'N5'],
      ['ja:vocab:運動', 'N4'],
    ]);
    expect(warnings.some((w) => w.includes('no JMdict match'))).toBe(true);
    expect(warnings.some((w) => w.includes('already took'))).toBe(true);
    // ...the dropped word keeps its row but loses its level.
    expect(update).toHaveBeenCalledWith({
      where: { id: 'ja:vocab:猫' },
      data: { data: { jmdict_id: '1467640', jlpt: null } },
    });
    expect(warnings.some((w) => w.includes('no longer on the lists'))).toBe(
      true,
    );
  });
});
