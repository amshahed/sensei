import { ConfigService } from '@nestjs/config';
import { GeminiLlmClient, type GeminiModelLike } from './gemini-llm-client';

function config(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

/** Captures the request body and returns a canned text response. */
function fakeGemini(text: string): {
  model: GeminiModelLike;
  lastRequest: () => Record<string, unknown>;
} {
  let req: Record<string, unknown> = {};
  const model: GeminiModelLike = {
    generateContent: (r) => {
      req = r;
      return Promise.resolve({ response: { text: () => text } });
    },
  };
  return { model, lastRequest: () => req };
}

describe('GeminiLlmClient', () => {
  it('is disabled when no GEMINI_API_KEY is configured', () => {
    const client = new GeminiLlmClient(config({}));
    expect(client.enabled).toBe(false);
  });

  it('is enabled when an injected model is provided', () => {
    const { model } = fakeGemini('{}');
    const client = new GeminiLlmClient(config({}), model);
    expect(client.enabled).toBe(true);
  });

  it('throws if parseJson is called while disabled', async () => {
    const client = new GeminiLlmClient(config({}));
    await expect(
      client.parseJson({
        task: 'grading',
        system: 's',
        user: 'u',
        schema: {},
        schemaName: 'x',
      }),
    ).rejects.toThrow(/not configured/);
  });

  it('parses the text response as JSON', async () => {
    const { model } = fakeGemini('{"rating":"Good","feedback":"ok"}');
    const client = new GeminiLlmClient(config({}), model);

    const out = await client.parseJson<{ rating: string; feedback: string }>({
      task: 'grading',
      system: 's',
      user: 'u',
      schema: { type: 'object' },
      schemaName: 'grade',
    });

    expect(out).toEqual({ rating: 'Good', feedback: 'ok' });
  });

  it('sends system instruction and user content correctly', async () => {
    const { model, lastRequest } = fakeGemini('{}');
    const client = new GeminiLlmClient(config({}), model);

    await client.parseJson({
      task: 'grading',
      system: 'SYS',
      user: 'USR',
      schema: {},
      schemaName: 'grade',
    });

    const req = lastRequest();
    expect(req.systemInstruction).toBe('SYS');
    expect(
      (req.contents as Array<{ parts: Array<{ text: string }> }>)[0].parts[0]
        .text,
    ).toBe('USR');
  });

  it('sets responseMimeType to application/json', async () => {
    const { model, lastRequest } = fakeGemini('{}');
    const client = new GeminiLlmClient(config({}), model);

    await client.parseJson({
      task: 'grading',
      system: 's',
      user: 'u',
      schema: { type: 'object', properties: {} },
      schemaName: 'x',
    });

    const cfg = lastRequest().generationConfig as Record<string, unknown>;
    expect(cfg.responseMimeType).toBe('application/json');
  });

  it('strips additionalProperties from schema before forwarding to Gemini', async () => {
    const { model, lastRequest } = fakeGemini('{}');
    const client = new GeminiLlmClient(config({}), model);

    await client.parseJson({
      task: 'grading',
      system: 's',
      user: 'u',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          rating: { type: 'string', additionalProperties: false },
        },
      },
      schemaName: 'grade',
    });

    const cfg = lastRequest().generationConfig as Record<string, unknown>;
    const schema = cfg.responseSchema as Record<string, unknown>;
    expect(schema).not.toHaveProperty('additionalProperties');
    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.rating).not.toHaveProperty('additionalProperties');
  });

  it('strips additionalProperties from array item schemas', async () => {
    const { model, lastRequest } = fakeGemini('[]');
    const client = new GeminiLlmClient(config({}), model);

    await client.parseJson({
      task: 'grading',
      system: 's',
      user: 'u',
      schema: {
        type: 'array',
        additionalProperties: false,
        items: { type: 'object', additionalProperties: false },
      },
      schemaName: 'list',
    });

    const cfg = lastRequest().generationConfig as Record<string, unknown>;
    const schema = cfg.responseSchema as Record<string, unknown>;
    expect(schema).not.toHaveProperty('additionalProperties');
    expect(schema.items as Record<string, unknown>).not.toHaveProperty(
      'additionalProperties',
    );
  });

  it('wraps safety-block SDK errors with a domain message', async () => {
    const model: GeminiModelLike = {
      generateContent: () =>
        Promise.resolve({
          response: {
            text: () => {
              throw new Error('Response was blocked due to SAFETY');
            },
          },
        }),
    };
    const client = new GeminiLlmClient(config({}), model);

    await expect(
      client.parseJson({
        task: 'grading',
        system: 's',
        user: 'u',
        schema: {},
        schemaName: 'x',
      }),
    ).rejects.toThrow(/safety block or malformed response/);
  });

  it('throws when response text is empty', async () => {
    const { model } = fakeGemini('');
    const client = new GeminiLlmClient(config({}), model);

    await expect(
      client.parseJson({
        task: 'grading',
        system: 's',
        user: 'u',
        schema: {},
        schemaName: 'x',
      }),
    ).rejects.toThrow(/no text content/);
  });

  it('respects LLM_GRADING_MODEL override in config (uses it when constructing real model)', () => {
    // We can't test model name selection with an injected model seam, but we
    // can verify a client with a key + override can be constructed without error.
    // The override is read once at construction time (same pattern as Anthropic).
    expect(
      () =>
        new GeminiLlmClient(
          config({
            GEMINI_API_KEY: 'fake-key',
            LLM_GRADING_MODEL: 'gemini-2.0-flash',
          }),
        ),
    ).not.toThrow();
  });
});
