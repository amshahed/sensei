import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { parseTatoeba, ingestTatoeba } from './tatoeba';
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

    const { voyage } = makeFakeVoyage();
    const executeRawMock = jest.fn().mockResolvedValue(1);
    const prisma = { $executeRaw: executeRawMock } as unknown as PrismaClient;

    await ingestTatoeba(prisma, voyage, tmp, false);

    expect(executeRawMock).toHaveBeenCalledTimes(2);
  });
});
