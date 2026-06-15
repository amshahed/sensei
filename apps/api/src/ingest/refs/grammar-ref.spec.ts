import { generateGrammarRef, ingestGrammarRefs } from './grammar-ref';
import { VoyageLike, VoyageClient } from '../../voyage/voyage-client';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';

const fakeConfig = () => ({ get: () => undefined }) as unknown as ConfigService;
const makeEmbedding = () => Array.from({ length: 1024 }, (_, i) => i / 1024);

function makeFakeVoyage(): VoyageClient {
  const fake: VoyageLike = {
    embed: jest.fn().mockImplementation((t: string[]) =>
      Promise.resolve({
        embeddings: t.map(() => makeEmbedding()),
        totalTokens: t.length * 15,
      }),
    ),
  };
  return new VoyageClient(fakeConfig(), fake);
}

function makeFakeAnthropicClient(text: string) {
  return {
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text }],
      }),
    },
  };
}

describe('generateGrammarRef', () => {
  it('calls Anthropic and returns passage text', async () => {
    const client = makeFakeAnthropicClient(
      'は marks the topic of a sentence...',
    );
    const result = await generateGrammarRef(
      client as unknown as Anthropic,
      'は',
      'N5',
    );
    expect(result).toContain('topic');
    expect(client.messages.create).toHaveBeenCalledTimes(1);
  });

  it('throws when Anthropic returns no text content', async () => {
    const client = {
      messages: { create: jest.fn().mockResolvedValue({ content: [] }) },
    };
    await expect(
      generateGrammarRef(client as unknown as Anthropic, 'は', 'N5'),
    ).rejects.toThrow('No text returned');
  });
});

describe('ingestGrammarRefs', () => {
  it('throws when voyage not enabled', async () => {
    const voyage = new VoyageClient(fakeConfig());
    await expect(
      ingestGrammarRefs({} as PrismaClient, voyage, 'key'),
    ).rejects.toThrow('VOYAGE_API_KEY');
  });

  it('throws when ANTHROPIC_API_KEY missing and no client injected', async () => {
    const voyage = makeFakeVoyage();
    await expect(
      ingestGrammarRefs({} as PrismaClient, voyage, ''),
    ).rejects.toThrow('ANTHROPIC_API_KEY');
  });

  it('throws when no grammar items in DB', async () => {
    const voyage = makeFakeVoyage();
    const prisma = {
      item: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;
    const fakeAnthropic = makeFakeAnthropicClient('passage');
    await expect(
      ingestGrammarRefs(
        prisma,
        voyage,
        'key',
        fakeAnthropic as unknown as Anthropic,
      ),
    ).rejects.toThrow('No grammar items');
  });

  it('generates passage and upserts one doc per grammar item', async () => {
    const voyage = makeFakeVoyage();
    const executeRawMock = jest.fn().mockResolvedValue(1);
    const prisma = {
      item: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'ja:grammar:wa',
            display: 'は',
            data: { pattern_name: 'は', jlpt_level: 'N5' },
          },
        ]),
      },
      $executeRaw: executeRawMock,
    } as unknown as PrismaClient;

    const fakeAnthropic = makeFakeAnthropicClient('Reference passage for は');
    await ingestGrammarRefs(
      prisma,
      voyage,
      'fake-key',
      fakeAnthropic as unknown as Anthropic,
    );

    expect(executeRawMock).toHaveBeenCalledTimes(1);
    expect(fakeAnthropic.messages.create).toHaveBeenCalledTimes(1);
  });
});
