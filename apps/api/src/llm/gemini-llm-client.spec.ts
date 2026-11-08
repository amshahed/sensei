import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiLlmClient, type GeminiModelLike } from './gemini-llm-client';
import { LlmCallError, type LlmFailureReason } from './llm-client';

const mockGetGenerativeModel = jest.fn();

jest.mock('@google/generative-ai', () => ({
  ...jest.requireActual<object>('@google/generative-ai'),
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: (...args: unknown[]) =>
      mockGetGenerativeModel(...args) as unknown,
  })),
}));

const { GoogleGenerativeAI: RealGoogleGenerativeAI } = jest.requireActual<
  typeof import('@google/generative-ai')
>('@google/generative-ai');

function config(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

/** Captures the request body and returns a canned text response. */
function fakeGemini(
  text: string,
  finishReason?: string,
): {
  model: GeminiModelLike;
  lastRequest: () => Record<string, unknown>;
} {
  let req: Record<string, unknown> = {};
  const model: GeminiModelLike = {
    generateContent: (r) => {
      req = r;
      return Promise.resolve({
        response: { text: () => text, candidates: [{ finishReason }] },
      });
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

  const ask = (client: GeminiLlmClient, maxTokens?: number) =>
    client.parseJson({
      task: 'grading',
      system: 's',
      user: 'u',
      schema: {},
      schemaName: 'x',
      maxTokens,
    });

  it('reports a reply cut off at the token limit as such, not as bad JSON', async () => {
    const { model } = fakeGemini('{"a": "cut', 'MAX_TOKENS');
    const client = new GeminiLlmClient(config({}), model);

    await expect(ask(client, 512)).rejects.toThrow(
      'Gemini reply hit the 512-token limit, so its JSON was cut off.',
    );
  });

  it('reports the default limit when the caller sets none', async () => {
    const { model } = fakeGemini('{"a": "cut', 'MAX_TOKENS');
    const client = new GeminiLlmClient(config({}), model);

    await expect(ask(client)).rejects.toThrow(/hit the 1024-token limit/);
  });

  it('reports the limit even when the cut-off reply has no text at all', async () => {
    // Gemini 2.5 spends thinking tokens from the same budget, so the limit can
    // be reached before a single character of the answer.
    const { model } = fakeGemini('', 'MAX_TOKENS');
    const client = new GeminiLlmClient(config({}), model);

    await expect(ask(client)).rejects.toThrow(/token limit/);
  });

  it('parses normally when the model stopped on its own', async () => {
    const { model } = fakeGemini('{"rating":"Good"}', 'STOP');
    const client = new GeminiLlmClient(config({}), model);

    await expect(ask(client)).resolves.toEqual({ rating: 'Good' });
  });

  it('replaces a reply that is not JSON with a message that does not quote it', async () => {
    const { model } = fakeGemini('kitty cat is what the learner said');
    const client = new GeminiLlmClient(config({}), model);

    const err = await ask(client).catch((e: Error) => e);

    expect((err as Error).message).toBe('Gemini reply was not valid JSON.');
  });

  describe('which model it asks for', () => {
    beforeEach(() => mockGetGenerativeModel.mockReset());

    const construct = (values: Record<string, string | undefined>) => {
      new GeminiLlmClient(config({ GEMINI_API_KEY: 'fake-key', ...values }));
      return mockGetGenerativeModel.mock.calls[0] as [
        { model: string },
        { timeout: number },
      ];
    };

    it('defaults to gemini-3.5-flash-lite', () => {
      expect(construct({})[0].model).toBe('gemini-3.5-flash-lite');
    });

    it.each(['', '   '])('treats a blank override (%j) as unset', (blank) => {
      expect(construct({ LLM_GRADING_MODEL: blank })[0].model).toBe(
        'gemini-3.5-flash-lite',
      );
    });

    it('uses LLM_GRADING_MODEL when set', () => {
      expect(
        construct({ LLM_GRADING_MODEL: 'gemini-3.1-flash-lite' })[0].model,
      ).toBe('gemini-3.1-flash-lite');
    });

    it('gives the SDK a 15-second request timeout', () => {
      expect(construct({})[1]).toEqual({ timeout: 15_000 });
    });
  });

  /** A model whose call rejects with `err`, as the SDK would. */
  function failing(err: unknown): GeminiModelLike {
    return { generateContent: () => Promise.reject(err as Error) };
  }

  describe('classifying a failed call', () => {
    const named = config({ LLM_GRADING_MODEL: 'gemini-x' });

    it.each<[number, LlmFailureReason]>([
      [404, 'model_unavailable'],
      [429, 'rate_limited'],
      [503, 'provider_error'],
      [500, 'provider_error'],
    ])('maps status %i to %s', async (status, reason) => {
      const sdkError = Object.assign(new Error('provider said no'), { status });
      const client = new GeminiLlmClient(named, failing(sdkError));

      const err = await ask(client).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(LlmCallError);
      expect(err).toMatchObject({
        reason,
        model: 'gemini-x',
        message: 'provider said no',
      });
    });

    it('calls an error with no status a provider error', async () => {
      const client = new GeminiLlmClient(named, failing(new Error('socket')));

      await expect(ask(client)).rejects.toMatchObject({
        reason: 'provider_error',
      });
    });

    it('does not read the status out of the message', async () => {
      const client = new GeminiLlmClient(named, failing(new Error('[404] x')));

      await expect(ask(client)).rejects.toMatchObject({
        reason: 'provider_error',
      });
    });

    describe('through the real SDK', () => {
      const realFetch = global.fetch;
      afterEach(() => {
        global.fetch = realFetch;
      });

      const realModel = () =>
        new RealGoogleGenerativeAI('fake-key').getGenerativeModel({
          model: 'gemini-x',
        }) as unknown as GeminiModelLike;

      it('recognises its abort error as a timeout', async () => {
        global.fetch = jest
          .fn()
          .mockRejectedValue(
            Object.assign(new Error('aborted'), { name: 'AbortError' }),
          );
        const client = new GeminiLlmClient(named, realModel());

        await expect(ask(client)).rejects.toMatchObject({ reason: 'timeout' });
      });

      it('recognises a real 404 body as a lost model', async () => {
        global.fetch = jest
          .fn()
          .mockResolvedValue(
            new Response(
              JSON.stringify({ error: { message: 'no longer available' } }),
              { status: 404, statusText: 'Not Found' },
            ),
          );
        const client = new GeminiLlmClient(named, realModel());

        const err = await ask(client).catch((e: Error) => e);

        expect(err).toMatchObject({ reason: 'model_unavailable' });
        expect((err as Error).message).toContain('no longer available');
        expect((err as Error).message).not.toContain('fake-key');
      });
    });
  });

  describe('startup model check', () => {
    let log: jest.SpyInstance;
    let warn: jest.SpyInstance;
    let error: jest.SpyInstance;
    const requested = config({ LLM_GRADING_MODEL: 'gemini-x' });

    beforeEach(() => {
      log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    });

    afterEach(() => jest.restoreAllMocks());

    const serving = (modelVersion?: string): GeminiModelLike => ({
      generateContent: jest.fn().mockResolvedValue({
        response: { text: () => 'pong', modelVersion },
      }),
    });

    it('sends a 5-token call with no schema', async () => {
      const model = serving('gemini-x');
      await new GeminiLlmClient(requested, model).checkModel();

      const [req] = (model.generateContent as jest.Mock).mock.calls[0] as [
        { generationConfig: Record<string, unknown> },
      ];
      expect(req.generationConfig).toEqual({ maxOutputTokens: 5 });
    });

    it('reports the model that served the call', async () => {
      await new GeminiLlmClient(requested, serving('gemini-x')).checkModel();

      expect(log).toHaveBeenCalledWith(
        'GRADING_MODEL_OK requested=gemini-x served=gemini-x',
      );
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });

    it('says unknown when Google does not name the served model', async () => {
      await new GeminiLlmClient(requested, serving()).checkModel();

      expect(log).toHaveBeenCalledWith(
        'GRADING_MODEL_OK requested=gemini-x served=unknown',
      );
    });

    it('warns when a different model served the call', async () => {
      await new GeminiLlmClient(requested, serving('gemini-y')).checkModel();

      expect(warn).toHaveBeenCalledWith(
        'GRADING_MODEL_REROUTED requested=gemini-x served=gemini-y',
      );
      expect(log).not.toHaveBeenCalled();
    });

    it('logs an error on a 404, and does not throw', async () => {
      const gone = Object.assign(new Error('no longer available'), {
        status: 404,
      });

      await expect(
        new GeminiLlmClient(requested, failing(gone)).checkModel(),
      ).resolves.toBeUndefined();

      expect(error).toHaveBeenCalledWith(
        'GRADING_MODEL_UNAVAILABLE model=gemini-x: no longer available',
      );
    });

    it.each<[number, LlmFailureReason]>([
      [429, 'rate_limited'],
      [503, 'provider_error'],
    ])('does not claim the model is gone on a %i', async (status, reason) => {
      const busy = Object.assign(new Error('busy'), { status });

      await new GeminiLlmClient(requested, failing(busy)).checkModel();

      expect(warn).toHaveBeenCalledWith(
        `GRADING_MODEL_UNCONFIRMED reason=${reason} model=gemini-x: busy`,
      );
      expect(error).not.toHaveBeenCalled();
    });

    it('does nothing when no key is configured', async () => {
      await expect(
        new GeminiLlmClient(config({})).checkModel(),
      ).resolves.toBeUndefined();

      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });

    describe('onApplicationBootstrap', () => {
      const realEnv = process.env.NODE_ENV;
      afterEach(() => {
        process.env.NODE_ENV = realEnv;
      });

      it('makes no call under test', () => {
        const model = serving('gemini-x');

        new GeminiLlmClient(requested, model).onApplicationBootstrap();

        expect(model.generateContent).not.toHaveBeenCalled();
      });

      it('starts the check outside test, without waiting for it', () => {
        process.env.NODE_ENV = 'production';
        const model: GeminiModelLike = {
          generateContent: jest.fn(() => new Promise(() => undefined)),
        } as unknown as GeminiModelLike;

        // Returns even though the call never settles.
        new GeminiLlmClient(requested, model).onApplicationBootstrap();

        expect(model.generateContent).toHaveBeenCalledTimes(1);
      });

      it('makes no call when no key is configured', () => {
        process.env.NODE_ENV = 'production';

        expect(() =>
          new GeminiLlmClient(config({})).onApplicationBootstrap(),
        ).not.toThrow();
      });
    });
  });
});
