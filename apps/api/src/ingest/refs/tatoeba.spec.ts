import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseTatoeba,
  ingestTatoeba,
  buildItemMatcher,
  selectForItems,
  MatchableItem,
} from './tatoeba';
import { VoyageLike, VoyageClient } from '../../voyage/voyage-client';
import {
  buildTokenizer,
  type JapaneseTokenizer,
} from '../../common/japanese-tokenizer';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

const fakeConfig = () => ({ get: () => undefined }) as unknown as ConfigService;
const tmpDir = os.tmpdir();

const makeEmbedding = () => Array.from({ length: 1024 }, (_, i) => i / 1024);

function makeFakeVoyage(): { voyage: VoyageClient; embedFn: jest.Mock } {
  const embedFn = jest.fn().mockImplementation((t: string[]) =>
    Promise.resolve({
      embeddings: t.map(() => makeEmbedding()),
      totalTokens: t.length * 10,
    }),
  );
  const fake: VoyageLike = { embed: embedFn };
  return { voyage: new VoyageClient(fakeConfig(), fake), embedFn };
}

// Real kuromoji/IPADIC: the point of the matcher is morphology, so faking it
// would test nothing. ~1 s to build, once.
let tokenizer: JapaneseTokenizer;
beforeAll(async () => {
  tokenizer = await buildTokenizer();
});

const vocab = (
  display: string,
  extra: Partial<MatchableItem> = {},
): MatchableItem => ({
  id: `ja:vocab:${display}`,
  type: 'VOCAB',
  display,
  ...extra,
});
const kanji = (literal: string): MatchableItem => ({
  id: `ja:kanji:${literal}`,
  type: 'KANJI',
  display: literal,
});

describe('parseTatoeba', () => {
  it('parses id\\tlang\\ttext format and filters to jpn', () => {
    const tsv = [
      '1\tjpn\t日本語のテスト文章です。',
      '2\teng\tThis is English.',
      '3\tjpn\tこれはOKのテスト文章です。',
    ].join('\n');
    const result = parseTatoeba(tsv, false);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].text).toBe('これはOKのテスト文章です。');
  });

  it('parses pre-filtered id\\ttext format', () => {
    const tsv = '10\t日本語のテスト文章です。\n11\t短い\n';
    const result = parseTatoeba(tsv, true);
    // '短い' is too short (< MIN_LEN 5)
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('10');
  });

  it('keeps short beginner sentences but drops fragments (< 5 chars)', () => {
    const tsv = '1\tjpn\t短い\n2\tjpn\t猫が好きです。';
    expect(parseTatoeba(tsv, false).map((s) => s.id)).toEqual(['2']);
  });

  it('filters out sentences longer than 120 chars', () => {
    const long = 'あ'.repeat(121);
    const ok = '日本語のテスト文章です。';
    const tsv = `1\tjpn\t${long}\n2\tjpn\t${ok}`;
    const result = parseTatoeba(tsv, false);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe(ok);
  });

  it('filters out sentences with URLs', () => {
    const tsv = [
      '1\tjpn\thttps://example.com を見てください',
      '2\tjpn\tこれはOKです。テストです。',
    ].join('\n');
    expect(parseTatoeba(tsv, false)).toHaveLength(1);
  });

  it('returns empty array for no matching sentences', () => {
    expect(parseTatoeba('1\teng\tOnly English here', false)).toHaveLength(0);
  });
});

describe('buildItemMatcher (real kuromoji)', () => {
  const hits = (items: MatchableItem[], text: string) =>
    [...buildItemMatcher(items, tokenizer)(text)].sort();

  it('is token-aligned: no match inside a longer word', () => {
    // Plain substring matching hit ある inside あるいは and その inside そのまま.
    expect(hits([vocab('ある')], '雨あるいは雪だ。')).toEqual([]);
    expect(hits([vocab('その')], 'そのままでいい。')).toEqual([]);
    expect(hits([vocab('その')], 'その本は高い。')).toEqual(['ja:vocab:その']);
  });

  it('matches conjugated forms via the dictionary form', () => {
    expect(hits([vocab('食べる')], 'パンを食べました。')).toEqual([
      'ja:vocab:食べる',
    ]);
    expect(hits([vocab('おいしい')], 'とてもおいしかった。')).toEqual([
      'ja:vocab:おいしい',
    ]);
  });

  it('matches multi-token compounds', () => {
    expect(hits([vocab('日本語')], '日本語を勉強します。')).toEqual([
      'ja:vocab:日本語',
    ]);
  });

  it('matches kana words on their kana variants (いい / よい)', () => {
    const ii = vocab('いい', {
      reading: 'いい',
      data: { readings: ['いい', 'よい'] },
    });
    expect(hits([ii], 'それはよかった。')).toEqual(['ja:vocab:いい']);
  });

  it('matches a kanji anywhere it appears', () => {
    expect(hits([kanji('日')], 'また明日。')).toEqual(['ja:kanji:日']);
  });
});

describe('selectForItems', () => {
  const s = (id: string, text: string) => ({ id, text });
  // Deterministic stand-in matcher: the morphology is covered above.
  const contains =
    (needles: Record<string, string>) =>
    (text: string): Set<string> =>
      new Set(
        Object.entries(needles)
          .filter(([, n]) => text.includes(n))
          .map(([id]) => id),
      );

  it("keeps each item's N shortest sentences and nothing unrelated", () => {
    const sentences = [
      s('1', '猫が好きです。とても好きです。'), // cat, longer
      s('2', '猫がいます。'), // cat, shortest
      s('3', '犬が走っています。'), // no item
      s('4', '猫と日本に行きました。'), // cat + day
    ];
    const kept = selectForItems(
      sentences,
      contains({ cat: '猫', day: '日' }),
      1,
    ).map((x) => x.id);
    expect(kept.sort()).toEqual(['2', '4']);
  });

  it('is deterministic on length ties (Tatoeba id order)', () => {
    const kept = selectForItems(
      [s('20', '猫がいます。'), s('10', '猫がいる。。')],
      contains({ cat: '猫' }),
      1,
    );
    expect(kept.map((x) => x.id)).toEqual(['10']);
  });
});

describe('ingestTatoeba', () => {
  const sentencesFile = (name: string, lines: string[]) => {
    const p = path.join(tmpDir, name);
    fs.writeFileSync(p, lines.join('\n'));
    return p;
  };
  const fakePrisma = (stored: string[]) => {
    const executeRaw = jest.fn().mockResolvedValue(1);
    const prisma = {
      item: {
        findMany: jest
          .fn()
          .mockResolvedValue([vocab('猫'), vocab('犬'), kanji('本')]),
      },
      $queryRaw: jest.fn().mockResolvedValue(stored.map((id) => ({ id }))),
      $executeRaw: executeRaw,
    } as unknown as PrismaClient;
    return { prisma, executeRaw };
  };
  const quiet = () => jest.spyOn(console, 'log').mockImplementation(() => {});

  it('throws when voyage not enabled', async () => {
    const voyage = new VoyageClient(fakeConfig());
    const tmp = sentencesFile('no-key.tsv', [
      '1\tjpn\t日本語のテスト文章です。',
    ]);
    await expect(
      ingestTatoeba({} as unknown as PrismaClient, voyage, tmp),
    ).rejects.toThrow('VOYAGE_API_KEY');
  });

  it('throws when no sentences match filter', async () => {
    const { voyage } = makeFakeVoyage();
    const tmp = sentencesFile('empty-tatoeba.tsv', ['1\teng\tOnly English']);
    await expect(
      ingestTatoeba({} as unknown as PrismaClient, voyage, tmp),
    ).rejects.toThrow('No Japanese sentences');
  });

  it('throws when no VOCAB/KANJI items are ingested yet', async () => {
    const tmp = sentencesFile('tatoeba-noitems.tsv', ['1\tjpn\t猫がいます。']);
    const { voyage } = makeFakeVoyage();
    const prisma = {
      item: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;
    await expect(ingestTatoeba(prisma, voyage, tmp)).rejects.toThrow(
      'ingest:items vocab',
    );
  });

  it('rejects a non-positive --per-item', async () => {
    const tmp = sentencesFile('tatoeba-perItem.tsv', ['1\tjpn\t猫がいます。']);
    const { voyage } = makeFakeVoyage();
    await expect(
      ingestTatoeba({} as unknown as PrismaClient, voyage, tmp, false, 0),
    ).rejects.toThrow('--per-item');
  });

  it('embeds only selected sentences that are not stored yet, and prunes the rest', async () => {
    const tmp = sentencesFile('tatoeba-sync.tsv', [
      '1\tjpn\t猫がいます。', // cat — already stored
      '2\tjpn\t犬が好きです。', // dog — new
      '3\tjpn\tこれは本です。', // 本 — new
      '4\tjpn\t今日は晴れです。', // no item → never stored
    ]);
    const { voyage, embedFn } = makeFakeVoyage();
    const { prisma, executeRaw } = fakePrisma([
      'tatoeba-1',
      'tatoeba-99', // stale: from an older, larger run
    ]);
    const log = quiet();

    await ingestTatoeba(prisma, voyage, tmp, false, 8, tokenizer);
    log.mockRestore();

    expect(embedFn).toHaveBeenCalledTimes(1);
    expect((embedFn.mock.calls[0] as [string[]])[0].sort()).toEqual(
      ['これは本です。', '犬が好きです。'].sort(),
    );
    // 2 upserts + 1 prune DELETE carrying the stale id
    expect(executeRaw).toHaveBeenCalledTimes(3);
    const deleteCall = executeRaw.mock.calls.find((c: unknown[]) =>
      String((c[0] as string[]).join('')).includes('DELETE'),
    ) as unknown[];
    expect(deleteCall.slice(1)).toEqual([['tatoeba-99']]);
  });

  it('does not call Voyage when everything selected is already stored', async () => {
    const tmp = sentencesFile('tatoeba-noop.tsv', ['1\tjpn\t猫がいます。']);
    const { voyage, embedFn } = makeFakeVoyage();
    const { prisma, executeRaw } = fakePrisma(['tatoeba-1']);
    const log = quiet();

    await ingestTatoeba(prisma, voyage, tmp, false, 8, tokenizer);
    log.mockRestore();

    expect(embedFn).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
  });
});
