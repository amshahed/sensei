import { ConfigService } from '@nestjs/config';
import { AnthropicLlmClient, type AnthropicLike } from './anthropic-llm-client';

function config(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

/** Captures the request body and returns a canned text response. */
function fakeAnthropic(text: string): {
  client: AnthropicLike;
  lastBody: () => Record<string, unknown>;
} {
  let body: Record<string, unknown> = {};
  const client: AnthropicLike = {
    messages: {
      create: (b: unknown) => {
        body = b as Record<string, unknown>;
        return Promise.resolve({ content: [{ type: 'text', text }] });
      },
    },
  };
  return { client, lastBody: () => body };
}

describe('AnthropicLlmClient', () => {
  it('is disabled when no API key is configured', () => {
    const client = new AnthropicLlmClient(config({}));
    expect(client.enabled).toBe(false);
  });

  it('is enabled when an injected client is provided', () => {
    const { client } = fakeAnthropic('{}');
    const llm = new AnthropicLlmClient(config({}), client);
    expect(llm.enabled).toBe(true);
  });

  it('throws if parseJson is called while disabled', async () => {
    const llm = new AnthropicLlmClient(config({}));
    await expect(
      llm.parseJson({
        task: 'grading',
        system: 's',
        user: 'u',
        schema: {},
        schemaName: 'x',
      }),
    ).rejects.toThrow(/not configured/);
  });

  it('parses the first text block as JSON', async () => {
    const { client } = fakeAnthropic('{"rating":"Good","feedback":"ok"}');
    const llm = new AnthropicLlmClient(config({}), client);

    const out = await llm.parseJson<{ rating: string; feedback: string }>({
      task: 'grading',
      system: 's',
      user: 'u',
      schema: { type: 'object' },
      schemaName: 'grade',
    });

    expect(out).toEqual({ rating: 'Good', feedback: 'ok' });
  });

  it('tiers the model per task (grading→haiku, authoring→opus) and honors overrides', async () => {
    const { client, lastBody } = fakeAnthropic('{}');

    const def = new AnthropicLlmClient(config({}), client);
    await def.parseJson({
      task: 'grading',
      system: 's',
      user: 'u',
      schema: {},
      schemaName: 'x',
    });
    expect(lastBody().model).toBe('claude-haiku-4-5');

    await def.parseJson({
      task: 'authoring',
      system: 's',
      user: 'u',
      schema: {},
      schemaName: 'x',
    });
    expect(lastBody().model).toBe('claude-opus-4-8');

    const overridden = new AnthropicLlmClient(
      config({ LLM_GRADING_MODEL: 'claude-sonnet-4-6' }),
      client,
    );
    await overridden.parseJson({
      task: 'grading',
      system: 's',
      user: 'u',
      schema: {},
      schemaName: 'x',
    });
    expect(lastBody().model).toBe('claude-sonnet-4-6');
  });

  it('sends a json_schema output_config and caches the system prefix when asked', async () => {
    const { client, lastBody } = fakeAnthropic('{}');
    const llm = new AnthropicLlmClient(config({}), client);

    await llm.parseJson({
      task: 'grading',
      system: 'SYS',
      user: 'u',
      schema: { type: 'object' },
      schemaName: 'grade',
      cacheSystem: true,
    });

    const body = lastBody();
    expect(body.output_config).toEqual({
      format: {
        type: 'json_schema',
        name: 'grade',
        schema: { type: 'object' },
      },
    });
    const system = body.system as Array<Record<string, unknown>>;
    expect(system[0]).toMatchObject({
      type: 'text',
      text: 'SYS',
      cache_control: { type: 'ephemeral' },
    });
  });
});
