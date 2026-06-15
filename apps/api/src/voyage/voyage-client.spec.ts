import { VoyageClient, VoyageLike } from './voyage-client';
import { ConfigService } from '@nestjs/config';

const fakeConfig = (key?: string) =>
  ({
    get: (k: string) => (k === 'VOYAGE_API_KEY' ? key : undefined),
  }) as unknown as ConfigService;

const makeEmbedding = (n: number) =>
  Array.from({ length: 1024 }, (_, i) => i / 1024 + n);

describe('VoyageClient', () => {
  describe('enabled flag', () => {
    it('is true when VOYAGE_API_KEY is set', () => {
      const client = new VoyageClient(fakeConfig('test-key'));
      expect(client.enabled).toBe(true);
    });

    it('is false when no key', () => {
      const client = new VoyageClient(fakeConfig(undefined));
      expect(client.enabled).toBe(false);
    });

    it('is true when fake client injected', () => {
      const fake: VoyageLike = {
        embed: jest.fn().mockResolvedValue({ embeddings: [], totalTokens: 0 }),
      };
      const client = new VoyageClient(fakeConfig(undefined), fake);
      expect(client.enabled).toBe(true);
    });
  });

  describe('embedOneBatch', () => {
    it('delegates to fake client and returns embeddings', async () => {
      const emb = makeEmbedding(0);
      const fake: VoyageLike = {
        embed: jest
          .fn()
          .mockResolvedValue({ embeddings: [emb], totalTokens: 42 }),
      };
      const client = new VoyageClient(fakeConfig(undefined), fake);

      const result = await client.embedOneBatch(['hello']);
      expect(result.embeddings).toHaveLength(1);
      expect(result.embeddings[0]).toEqual(emb);
      expect(result.totalTokens).toBe(42);
    });

    it('throws when not enabled', async () => {
      const client = new VoyageClient(fakeConfig(undefined));
      await expect(client.embedOneBatch(['test'])).rejects.toThrow(
        'no API key',
      );
    });

    it('retries on 429 and succeeds on second attempt', async () => {
      const emb = makeEmbedding(1);
      let calls = 0;
      const fake: VoyageLike = {
        embed: jest.fn().mockImplementation(() => {
          calls++;
          if (calls === 1) {
            const err = Object.assign(new Error('rate limited'), {
              status: 429,
            });
            return Promise.reject(err);
          }
          return Promise.resolve({ embeddings: [emb], totalTokens: 10 });
        }),
      };
      const client = new VoyageClient(fakeConfig(undefined), fake);

      // Override sleep to avoid test delay
      jest.useFakeTimers();
      const promise = client.embedOneBatch(['test'], 3);
      await jest.runAllTimersAsync();
      const result = await promise;
      jest.useRealTimers();

      expect(calls).toBe(2);
      expect(result.embeddings[0]).toEqual(emb);
    });

    it('throws after maxRetries exhausted on persistent 429', async () => {
      const fake: VoyageLike = {
        embed: jest
          .fn()
          .mockRejectedValue(Object.assign(new Error('429'), { status: 429 })),
      };
      const client = new VoyageClient(fakeConfig(undefined), fake);
      // maxRetries=0 → single attempt, throws immediately with no sleep needed
      await expect(client.embedOneBatch(['test'], 0)).rejects.toThrow('429');
    });
  });

  describe('embedAll', () => {
    it('batches calls and concatenates results', async () => {
      const embeddings = [makeEmbedding(0), makeEmbedding(1), makeEmbedding(2)];
      let callIdx = 0;
      const embedFn = jest.fn().mockImplementation((texts: string[]) => {
        const result = embeddings.slice(callIdx, callIdx + texts.length);
        callIdx += texts.length;
        return Promise.resolve({
          embeddings: result,
          totalTokens: texts.length * 10,
        });
      });
      const fake: VoyageLike = { embed: embedFn };
      const client = new VoyageClient(fakeConfig(undefined), fake);

      const result = await client.embedAll(['a', 'b', 'c'], 2);
      expect(result.embeddings).toHaveLength(3);
      expect(result.totalTokens).toBe(30);
      // Two batch calls: ['a','b'] and ['c']
      expect(embedFn).toHaveBeenCalledTimes(2);
    });

    it('returns embeddings in input order', async () => {
      const embs = [makeEmbedding(0), makeEmbedding(1)];
      let i = 0;
      const fake: VoyageLike = {
        embed: jest.fn().mockImplementation((texts: string[]) => ({
          embeddings: texts.map(() => embs[i++]),
          totalTokens: 5,
        })),
      };
      const client = new VoyageClient(fakeConfig(undefined), fake);

      const result = await client.embedAll(['first', 'second'], 10);
      expect(result.embeddings[0]).toEqual(embs[0]);
      expect(result.embeddings[1]).toEqual(embs[1]);
    });
  });
});
