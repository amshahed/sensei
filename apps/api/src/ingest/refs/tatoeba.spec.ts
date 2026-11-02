import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseTatoeba,
  ingestTatoeba,
  buildMatchKeys,
  selectForItems,
} from './tatoeba';
import { VoyageLike, VoyageClient } from '../../voyage/voyage-client';
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
    // '短い' is too short (< MIN_LEN 10)
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('10');
  });

  it('filters out sentences shorter than 10 chars', () => {
    const tsv =
      '1\tjpn\t短い\n2\tjpn\t日本語のちゃんとした文章はここにあります。';
    expect(parseTatoeba(tsv, false)).toHaveLength(1);
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

describe('buildMatchKeys', () => {
  it('adds a stem needle for kanji+okurigana words only', () => {
    expect(
      buildMatchKeys([
        { id: 'v:食べる', display: '食べる' },
        { id: 'v:行く', display: '行く' }, // stem 行 too short — skipped
        { id: 'v:これ', display: 'これ' }, // no kanji
        { id: 'k:日', display: '日' },
      ]),
    ).toEqual([
      { itemId: 'v:食べる', needle: '食べる' },
      { itemId: 'v:食べる', needle: '食べ' },
      { itemId: 'v:行く', needle: '行く' },
      { itemId: 'v:これ', needle: 'これ' },
      { itemId: 'k:日', needle: '日' },
    ]);
  });
});

describe('selectForItems', () => {
  const s = (id: string, text: string) => ({ id, text });

  it("keeps each item's N shortest sentences and nothing unrelated", () => {
    const sentences = [
      s('1', '猫が好きです。とても好きです。'), // 猫, longer
      s('2', '猫がいます。'), // 猫, shortest
      s('3', '犬が走っています。'), // no item
      s('4', '猫と日本に行きました。'), // 猫 + 日
    ];
    const keys = [
      { itemId: 'cat', needle: '猫' },
      { itemId: 'day', needle: '日' },
    ];
    const kept = selectForItems(sentences, keys, 1).map((x) => x.id);
    // cat's single slot → '2' (shortest); day's → '4' (only match)
    expect(kept.sort()).toEqual(['2', '4']);
  });

  it('matches conjugations through the stem needle', () => {
    const kept = selectForItems(
      [s('1', 'パンを食べました。')],
      buildMatchKeys([{ id: 'eat', display: '食べる' }]),
      3,
    );
    expect(kept).toHaveLength(1);
  });

  it('is deterministic on length ties (Tatoeba id order)', () => {
    const sentences = [s('20', '猫がいます。'), s('10', '猫がいる。。')];
    const kept = selectForItems(sentences, [{ itemId: 'c', needle: '猫' }], 1);
    expect(kept.map((x) => x.id)).toEqual(['10']);
  });
});

describe('ingestTatoeba', () => {
  it('throws when voyage not enabled', async () => {
    const voyage = new VoyageClient(fakeConfig());
    const tmp = path.join(tmpDir, 'no-key.tsv');
    fs.writeFileSync(tmp, '1\tjpn\t日本語のテスト文章です。\n');
    await expect(
      ingestTatoeba({} as unknown as PrismaClient, voyage, tmp),
    ).rejects.toThrow('VOYAGE_API_KEY');
  });

  it('throws when no sentences match filter', async () => {
    const { voyage } = makeFakeVoyage();
    const tmp = path.join(tmpDir, 'empty-tatoeba.tsv');
    fs.writeFileSync(tmp, '1\teng\tOnly English\n');
    await expect(
      ingestTatoeba({} as unknown as PrismaClient, voyage, tmp),
    ).rejects.toThrow('No Japanese sentences');
  });

  it('embeds and upserts sentences', async () => {
    const sentences = ['日本語のテスト文章です。', 'これはサンプル文章です。'];
    const tsv = sentences.map((t, i) => `${i + 1}\tjpn\t${t}`).join('\n');
    const tmp = path.join(tmpDir, 'tatoeba-test.tsv');
    fs.writeFileSync(tmp, tsv);

    const { voyage, embedFn } = makeFakeVoyage();
    const executeRawMock = jest.fn().mockResolvedValue(1);
    const prisma = {
      $executeRaw: executeRawMock,
      item: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'ja:vocab:日本語', display: '日本語' }]),
      },
    } as unknown as PrismaClient;

    await ingestTatoeba(prisma, voyage, tmp, false);

    // only the sentence containing an ingested item is embedded + stored
    expect(embedFn).toHaveBeenCalledWith(
      ['日本語のテスト文章です。'],
      expect.anything(),
    );
    expect(executeRawMock).toHaveBeenCalledTimes(1);
  });

  it('throws when no VOCAB/KANJI items are ingested yet', async () => {
    const tmp = path.join(tmpDir, 'tatoeba-noitems.tsv');
    fs.writeFileSync(tmp, '1\tjpn\t日本語のテスト文章です。\n');
    const { voyage } = makeFakeVoyage();
    const prisma = {
      item: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;
    await expect(ingestTatoeba(prisma, voyage, tmp)).rejects.toThrow(
      'ingest:items vocab',
    );
  });

  it('rejects a non-positive --per-item', async () => {
    const tmp = path.join(tmpDir, 'tatoeba-perItem.tsv');
    fs.writeFileSync(tmp, '1\tjpn\t日本語のテスト文章です。\n');
    const { voyage } = makeFakeVoyage();
    await expect(
      ingestTatoeba({} as unknown as PrismaClient, voyage, tmp, false, 0),
    ).rejects.toThrow('--per-item');
  });
});
