import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-3';
const VOYAGE_DIMS = 1024;
const BATCH_SIZE = 128;

export interface VoyageEmbedResponse {
  data: Array<{ index: number; embedding: number[] }>;
  usage: { total_tokens: number };
}

/** Minimal structural seam for tests — mirrors AnthropicLike pattern. */
export interface VoyageLike {
  embed(
    texts: string[],
    model: string,
  ): Promise<{ embeddings: number[][]; totalTokens: number }>;
}

async function callVoyageApi(
  texts: string[],
  apiKey: string,
): Promise<{ embeddings: number[][]; totalTokens: number }> {
  const res = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: texts,
      input_type: 'document',
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw Object.assign(new Error(`Voyage API error ${res.status}: ${body}`), {
      status: res.status,
    });
  }

  const json = (await res.json()) as VoyageEmbedResponse;
  const ordered = [...json.data].sort((a, b) => a.index - b.index);
  return {
    embeddings: ordered.map((d) => d.embedding),
    totalTokens: json.usage.total_tokens,
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Thin Voyage AI embeddings wrapper (decisions L.4 provider abstraction pattern).
 * Injectable in NestJS; also usable standalone in CLI scripts.
 */
@Injectable()
export class VoyageClient {
  private readonly logger = new Logger(VoyageClient.name);
  private readonly apiKey: string | null;
  private readonly fakeClient: VoyageLike | null;

  constructor(
    config: ConfigService,
    /** Test seam: inject a fake instead of hitting the network. */
    @Optional() client?: VoyageLike,
  ) {
    if (client) {
      this.fakeClient = client;
      this.apiKey = null;
    } else {
      this.fakeClient = null;
      this.apiKey = config.get<string>('VOYAGE_API_KEY') ?? null;
    }
    if (!this.enabled) {
      this.logger.warn(
        'VOYAGE_API_KEY not set — embedding disabled; ingest:refs commands will fail.',
      );
    }
  }

  get enabled(): boolean {
    return this.fakeClient !== null || this.apiKey !== null;
  }

  /** Embed a single batch (≤ BATCH_SIZE), with exponential backoff on 429. */
  async embedOneBatch(
    texts: string[],
    maxRetries = 5,
  ): Promise<{ embeddings: number[][]; totalTokens: number }> {
    if (!this.fakeClient && !this.apiKey) {
      throw new Error('VoyageClient: no API key configured.');
    }

    let delay = 2000;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (this.fakeClient) {
          return await this.fakeClient.embed(texts, VOYAGE_MODEL);
        }
        return await callVoyageApi(texts, this.apiKey!);
      } catch (err: unknown) {
        const status =
          err instanceof Error && 'status' in err
            ? (err as Error & { status: number }).status
            : undefined;
        if (status === 429 && attempt < maxRetries) {
          this.logger.warn(
            `Rate limited by Voyage AI; retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
          );
          await sleep(delay);
          delay = Math.min(delay * 2, 60_000);
        } else {
          throw err;
        }
      }
    }
    // Unreachable — loop always throws or returns.
    /* istanbul ignore next */
    throw new Error('Voyage embed: exhausted retries');
  }

  /** Embed an arbitrary number of texts in batches, returning all embeddings in order. */
  async embedAll(
    texts: string[],
    batchSize = BATCH_SIZE,
  ): Promise<{ embeddings: number[][]; totalTokens: number }> {
    const allEmbeddings: number[][] = [];
    let totalTokens = 0;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const result = await this.embedOneBatch(batch);
      allEmbeddings.push(...result.embeddings);
      totalTokens += result.totalTokens;
    }

    return { embeddings: allEmbeddings, totalTokens };
  }

  static readonly MODEL = VOYAGE_MODEL;
  static readonly DIMS = VOYAGE_DIMS;
}

/**
 * Standalone factory for CLI scripts (bypasses NestJS DI).
 * Reads VOYAGE_API_KEY from process.env directly.
 */
export function makeVoyageClient(): VoyageClient {
  const apiKey = process.env['VOYAGE_API_KEY'] ?? '';
  const fakeConfig = {
    get: (key: string) => (key === 'VOYAGE_API_KEY' ? apiKey : undefined),
  } as unknown as ConfigService;
  return new VoyageClient(fakeConfig);
}
