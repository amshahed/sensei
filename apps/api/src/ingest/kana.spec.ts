import { ALL_KANA } from './kana-data';
import { buildKanaItem, ingestKana } from './kana';

describe('kana data', () => {
  it('has 92 entries (46 hiragana + 46 katakana)', () => {
    expect(ALL_KANA).toHaveLength(92);
    expect(ALL_KANA.filter((k) => k.script === 'hiragana')).toHaveLength(46);
    expect(ALL_KANA.filter((k) => k.script === 'katakana')).toHaveLength(46);
  });

  it('has no duplicate IDs', () => {
    const ids = ALL_KANA.map((k) => k.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('hiragana IDs use romaji prefix (ja:kana:<romaji>)', () => {
    const hiragana = ALL_KANA.filter((k) => k.script === 'hiragana');
    for (const k of hiragana) {
      expect(k.id).toMatch(/^ja:kana:[a-z]+$/);
    }
  });

  it('katakana IDs use kata- prefix (ja:kana:kata-<romaji>)', () => {
    const katakana = ALL_KANA.filter((k) => k.script === 'katakana');
    for (const k of katakana) {
      expect(k.id).toMatch(/^ja:kana:kata-[a-z]+$/);
    }
  });

  it('hiragana vowels match existing seed IDs', () => {
    const seedIds = [
      'ja:kana:a',
      'ja:kana:i',
      'ja:kana:u',
      'ja:kana:e',
      'ja:kana:o',
    ];
    const hiraganaIds = ALL_KANA.filter((k) => k.script === 'hiragana').map(
      (k) => k.id,
    );
    for (const id of seedIds) {
      expect(hiraganaIds).toContain(id);
    }
  });
});

describe('buildKanaItem', () => {
  it('maps a hiragana entry to an Item shape', () => {
    const entry = {
      id: 'ja:kana:a',
      display: 'あ',
      romaji: 'a',
      script: 'hiragana' as const,
    };
    const item = buildKanaItem(entry);
    expect(item).toEqual({
      id: 'ja:kana:a',
      language: 'ja',
      type: 'KANA',
      display: 'あ',
      reading: 'あ',
      meaning: null,
      data: { romaji: 'a', script: 'hiragana' },
    });
  });

  it('maps a katakana entry to an Item shape', () => {
    const entry = {
      id: 'ja:kana:kata-ka',
      display: 'カ',
      romaji: 'ka',
      script: 'katakana' as const,
    };
    const item = buildKanaItem(entry);
    expect(item.type).toBe('KANA');
    expect(item.data).toEqual({ romaji: 'ka', script: 'katakana' });
  });
});

describe('ingestKana', () => {
  it('upserts all 92 kana via prisma', async () => {
    const upsertMock = jest.fn().mockResolvedValue({});
    const transactionMock = jest
      .fn()
      .mockImplementation((ops: unknown[]) =>
        Promise.resolve(ops.map(() => ({}))),
      );
    const prisma = {
      item: { upsert: upsertMock },
      $transaction: transactionMock,
    } as unknown as import('@prisma/client').PrismaClient;

    await ingestKana(prisma);

    expect(transactionMock).toHaveBeenCalledTimes(1);
    const calls = transactionMock.mock.calls as [unknown[]][];
    const ops = calls[0][0];
    // $transaction receives an array of promises — one per kana
    expect(ops).toHaveLength(92);
  });
});
