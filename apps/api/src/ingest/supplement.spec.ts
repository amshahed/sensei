import type { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { hasKanji } from '../common/japanese-script';
import { recallQuestionFor } from '../recall/recall-question';
import { ingestGrammar, slugify } from './grammar';
import {
  buildGrammarSupplementRows,
  buildVocabSupplementRows,
  ingestSupplement,
  loadGrammarSupplement,
  loadVocabSupplement,
  type GrammarSupplement,
} from './supplement';
import type { JmdictWord } from './vocab';

const word = (
  id: string,
  kanji: string[],
  kana: string[],
  ...senses: string[][]
): JmdictWord => ({
  id,
  kanji: kanji.map((text) => ({ text, tags: [], common: true })),
  kana: kana.map((text) => ({
    text,
    tags: [],
    common: true,
    appliesToKanji: ['*'],
  })),
  sense: senses.map((glosses) => ({
    gloss: glosses.map((text) => ({ lang: 'eng', text })),
  })),
});

const PHRASE = word(
  '1',
  ['今日は'],
  ['こんにちは'],
  ['hello', 'good day'],
  ['other sense'],
);
const COUNTRY = word('2', ['日本'], ['にほん', 'にっぽん'], ['Japan']);

describe('buildVocabSupplementRows', () => {
  it('builds a phrase in kana with every gloss of its first sense and no level', () => {
    const [row] = buildVocabSupplementRows(
      [
        {
          jmdict_id: '1',
          display: 'こんにちは',
          reading: 'こんにちは',
          multi_word: true,
        },
      ],
      [PHRASE],
    );
    expect(row).toMatchObject({
      id: 'ja:vocab:こんにちは',
      type: 'VOCAB',
      display: 'こんにちは',
      reading: 'こんにちは',
      meaning: 'hello; good day',
      data: { jlpt: null, multi_word: true, jmdict_id: '1' },
    });
  });

  it('builds an ordinary word with its spelling and no multi_word flag', () => {
    const [row] = buildVocabSupplementRows(
      [{ jmdict_id: '2', display: '日本', reading: 'にほん' }],
      [COUNTRY],
    );
    expect(row).toMatchObject({
      id: 'ja:vocab:日本',
      display: '日本',
      reading: 'にほん',
      meaning: 'Japan',
      data: { jlpt: null },
    });
    expect(row.data).not.toHaveProperty('multi_word');
  });

  it('prefers a meaning the PM set in the file', () => {
    const [row] = buildVocabSupplementRows(
      [
        {
          jmdict_id: '1',
          display: 'こんにちは',
          reading: 'こんにちは',
          multi_word: true,
          meaning: 'hello',
        },
      ],
      [PHRASE],
    );
    expect(row.meaning).toBe('hello');
  });

  it('refuses an id JMdict does not have, or a form that entry lacks', () => {
    expect(() =>
      buildVocabSupplementRows(
        [{ jmdict_id: '9', display: 'x', reading: 'x' }],
        [PHRASE],
      ),
    ).toThrow(/no entry 9/);
    expect(() =>
      buildVocabSupplementRows(
        [{ jmdict_id: '1', display: 'さよなら', reading: 'さよなら' }],
        [PHRASE],
      ),
    ).toThrow(/no form/);
  });
});

describe('the committed supplement files', () => {
  const vocab = loadVocabSupplement();
  const grammar = loadGrammarSupplement();

  it('has 22 words, 20 of them phrases stored in kana', () => {
    expect(vocab).toHaveLength(22);
    const phrases = vocab.filter((v) => v.multi_word);
    expect(phrases).toHaveLength(20);
    expect(phrases.every((p) => !hasKanji(p.display))).toBe(true);
    expect(new Set(vocab.map((v) => v.jmdict_id)).size).toBe(22);
  });

  it('has 24 meanings, each at most 100 characters and free of kanji (P8, P9)', () => {
    const entries = Object.entries(grammar.meanings);
    expect(entries).toHaveLength(24);
    for (const [id, meaning] of entries) {
      expect([id, meaning.length <= 100]).toEqual([id, true]);
      expect([id, hasKanji(meaning)]).toEqual([id, false]);
    }
  });

  it('adds 10 new patterns with no level and no source order', () => {
    const rows = buildGrammarSupplementRows(grammar);
    expect(rows).toHaveLength(10);
    for (const row of rows) {
      expect(row.data.jlpt_level).toBeNull();
      expect(row.data).not.toHaveProperty('source_order');
      expect(row.meaning).toBe(grammar.meanings[row.id]);
    }
    expect(rows.map((r) => r.display)).toEqual([
      'か',
      'の',
      'じゃありません',
      'ます',
      'ません',
      'ました',
      'て-form',
      'い-adjective',
      'な-adjective',
      '〜がすきです',
    ]);
  });

  it('uses the kana form of the "I like" pattern, never 好 (content review C1)', () => {
    expect(Object.keys(grammar.meanings)).toContain('ja:grammar:がすきです');
    expect(slugify('〜がすきです')).toBe('がすきです');
    expect(JSON.stringify(grammar)).not.toContain('好');
  });

  it('makes a grammar item quizzable once it has a meaning (P8)', () => {
    const [row] = buildGrammarSupplementRows(grammar);
    expect(
      recallQuestionFor({ ...row, type: 'GRAMMAR', reading: null }),
    ).toMatchObject({ check: 'meaning', expected: row.meaning });
  });
});

describe('ingestSupplement', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'supplement-'));
  const source = path.join(dir, 'jmdict.json');
  fs.writeFileSync(source, JSON.stringify({ words: [PHRASE] }));
  fs.writeFileSync(
    path.join(dir, 'vocab-supplement.json'),
    JSON.stringify([
      {
        jmdict_id: '1',
        display: 'こんにちは',
        reading: 'こんにちは',
        multi_word: true,
      },
    ]),
  );
  const supplement: GrammarSupplement = {
    new: [{ pattern: 'か' }],
    meanings: { 'ja:grammar:か': 'question', 'ja:grammar:は': 'topic' },
  };
  fs.writeFileSync(
    path.join(dir, 'grammar-supplement.json'),
    JSON.stringify(supplement),
  );

  /** A store where row presence and meaning behave like the real table. */
  function fakeDb(existing: Record<string, string | null>) {
    const store = new Map(Object.entries(existing));
    const createMany = jest.fn(
      ({ data }: { data: Array<{ id: string; meaning: string | null }> }) => {
        let count = 0;
        for (const row of data) {
          if (store.has(row.id)) continue;
          store.set(row.id, row.meaning);
          count++;
        }
        return Promise.resolve({ count });
      },
    );
    const updateMany = jest.fn(
      ({
        where,
        data,
      }: {
        where: { id: string; meaning?: null };
        data: { meaning: string };
      }) => {
        if (where.meaning !== null) throw new Error('fill only empty meanings');
        if (!store.has(where.id) || store.get(where.id) !== null)
          return Promise.resolve({ count: 0 });
        store.set(where.id, data.meaning);
        return Promise.resolve({ count: 1 });
      },
    );
    const findMany = jest.fn(({ where }: { where: { id: { in: string[] } } }) =>
      Promise.resolve(
        where.id.in.filter((id) => store.has(id)).map((id) => ({ id })),
      ),
    );
    const prisma = {
      item: { createMany, updateMany, findMany },
    } as unknown as PrismaClient;
    return { prisma, store, createMany, updateMany };
  }

  let log: jest.SpyInstance;
  beforeEach(() => {
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => log.mockRestore());

  it('only inserts and fills empty meanings, and a second run does nothing', async () => {
    const db = fakeDb({ 'ja:grammar:は': null });
    await ingestSupplement(db.prisma, source, dir);
    expect(db.store.get('ja:grammar:か')).toBe('question');
    expect(db.store.get('ja:grammar:は')).toBe('topic');
    expect(db.store.get('ja:vocab:こんにちは')).toBe('hello; good day');
    expect(db.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    expect(log).toHaveBeenLastCalledWith(
      expect.stringContaining('inserted 2 of 2 rows, filled 1'),
    );

    await ingestSupplement(db.prisma, source, dir);
    expect(log).toHaveBeenLastCalledWith(
      expect.stringContaining('inserted 0 of 2 rows, filled 0'),
    );
  });

  it('never overwrites a meaning that is already set', async () => {
    const db = fakeDb({ 'ja:grammar:は': 'kept' });
    await ingestSupplement(db.prisma, source, dir);
    expect(db.store.get('ja:grammar:は')).toBe('kept');
  });

  it('fails when a grammar meaning has no row to land on', async () => {
    const db = fakeDb({});
    await expect(ingestSupplement(db.prisma, source, dir)).rejects.toThrow(
      /ja:grammar:は/,
    );
  });
});

describe('ingestGrammar on re-ingest', () => {
  it('does not write a null meaning over a stored one', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grammar-'));
    const file = path.join(dir, 'g.json');
    fs.writeFileSync(file, JSON.stringify([{ pattern: 'は', order: 1 }]));
    const upsert = jest.fn().mockResolvedValue({});
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await ingestGrammar({ item: { upsert } } as unknown as PrismaClient, file);
    log.mockRestore();
    const [[args]] = upsert.mock.calls as [[{ update: object }]];
    expect(args.update).not.toHaveProperty('meaning');
  });
});
