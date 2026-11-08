import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  GoogleGenerativeAIAbortError,
} from '@google/generative-ai';
import type { Schema as GeminiSchema } from '@google/generative-ai';
import {
  LlmCallError,
  type LlmClient,
  type LlmFailureReason,
  type ParseJsonOptions,
} from './llm-client';
import { DEFAULT_GEMINI_GRADING_MODEL, modelOrDefault } from './model-defaults';

/**
 * Minimal structural view of the Gemini SDK surface we use. Keeping the seam
 * loose lets tests inject a fake without the SDK's strict request types, while
 * production passes the real GenerativeModel through.
 */
export interface GeminiModelLike {
  generateContent(request: GeminiRequest): Promise<{
    response: {
      text(): string;
      candidates?: Array<{ finishReason?: string }>;
      /** The model that actually served the call, which can differ from the one asked for. */
      modelVersion?: string;
    };
  }>;
}

export interface GeminiRequest {
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  systemInstruction?: string;
  generationConfig?: Record<string, unknown>;
}

/** Longer than the 12-second learner cap in GradingService, which stays in charge there. */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Classified from the SDK's numeric `status` and error class, never its text.
 * The abort error has to be matched by class: the SDK doesn't set its `name`.
 */
function failureReason(err: unknown): LlmFailureReason {
  if (err instanceof GoogleGenerativeAIAbortError) return 'timeout';
  const status = (err as { status?: unknown } | null)?.status;
  if (status === 404) return 'model_unavailable';
  if (status === 429) return 'rate_limited';
  return 'provider_error';
}

/** Strip `additionalProperties` recursively — Gemini's responseSchema ignores it but some versions reject it. */
function toGeminiSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { additionalProperties: _dropped, ...rest } = schema;
  if (rest.properties && typeof rest.properties === 'object') {
    const props = rest.properties as Record<string, Record<string, unknown>>;
    rest.properties = Object.fromEntries(
      Object.entries(props).map(([k, v]) => [k, toGeminiSchema(v)]),
    );
  }
  if (rest.items && typeof rest.items === 'object') {
    rest.items = toGeminiSchema(rest.items as Record<string, unknown>);
  }
  return rest;
}

@Injectable()
export class GeminiLlmClient implements LlmClient, OnApplicationBootstrap {
  private readonly logger = new Logger(GeminiLlmClient.name);
  private readonly model: GeminiModelLike | null;
  private readonly modelName: string;

  constructor(
    private readonly config: ConfigService,
    /**
     * Test seam: inject a fake model instead of hitting the network.
     * `@Optional()` prevents Nest from failing to resolve this interface type at boot.
     */
    @Optional() model?: GeminiModelLike,
  ) {
    this.modelName = modelOrDefault(
      config.get<string>('LLM_GRADING_MODEL'),
      DEFAULT_GEMINI_GRADING_MODEL,
    );
    if (model) {
      this.model = model;
    } else {
      const apiKey = config.get<string>('GEMINI_API_KEY');
      if (apiKey) {
        const genAI = new GoogleGenerativeAI(apiKey);
        this.model = genAI.getGenerativeModel(
          { model: this.modelName },
          { timeout: REQUEST_TIMEOUT_MS },
        );
      } else {
        this.model = null;
        this.logger.warn(
          'GEMINI_API_KEY not set — AI grading disabled, falling back to deterministic grading.',
        );
      }
    }
  }

  get enabled(): boolean {
    return this.model !== null;
  }

  async parseJson<T>(opts: ParseJsonOptions): Promise<T> {
    if (!this.model) {
      throw new Error(
        'Gemini LLM client is not configured (no GEMINI_API_KEY).',
      );
    }

    const maxTokens = opts.maxTokens ?? 1024;
    const result = await this.generate(this.model, {
      contents: [{ role: 'user', parts: [{ text: opts.user }] }],
      systemInstruction: opts.system,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(opts.schema) as unknown as GeminiSchema,
        maxOutputTokens: maxTokens,
      },
    });

    // Checked first: the SDK's text() lets MAX_TOKENS through, and thinking
    // shares this budget, so a cut-off reply may be partial or empty.
    if (result.response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      throw new Error(
        `Gemini reply hit the ${maxTokens}-token limit, so its JSON was cut off.`,
      );
    }

    let text: string;
    try {
      text = result.response.text();
    } catch (err) {
      throw new Error(
        `Gemini response unreadable (safety block or malformed response): ${String(err)}`,
      );
    }
    if (!text) {
      throw new Error('Gemini returned no text content to parse.');
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      // A fixed message: JSON.parse quotes the reply, which can repeat the
      // learner's answer, and this ends up in the logs.
      throw new Error('Gemini reply was not valid JSON.');
    }
  }

  /**
   * Starts the model check without delaying boot. Skipped under test because
   * the integration spec boots the real AppModule on machines holding a key.
   */
  onApplicationBootstrap(): void {
    if (!this.model || process.env.NODE_ENV === 'test') return;
    void this.checkModel();
  }

  /**
   * One real 5-token call, because a model lookup says yes for a model that
   * 404s on generateContent. Reports through the logs and never throws: a lost
   * grader degrades grading, it must not stop the API from starting.
   */
  async checkModel(): Promise<void> {
    if (!this.model) return;
    const requested = this.modelName;
    try {
      const { response } = await this.generate(this.model, {
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 5 },
      });
      const served = response.modelVersion;
      if (served && served !== requested) {
        this.logger.warn(
          `GRADING_MODEL_REROUTED requested=${requested} served=${served}`,
        );
      } else {
        this.logger.log(
          `GRADING_MODEL_OK requested=${requested} served=${served ?? 'unknown'}`,
        );
      }
    } catch (err) {
      const { reason, message } = err as LlmCallError;
      if (reason === 'model_unavailable') {
        this.logger.error(
          `GRADING_MODEL_UNAVAILABLE model=${requested}: ${message}`,
        );
      } else {
        this.logger.warn(
          `GRADING_MODEL_UNCONFIRMED reason=${reason} model=${requested}: ${message}`,
        );
      }
    }
  }

  private async generate(model: GeminiModelLike, request: GeminiRequest) {
    try {
      return await model.generateContent(request);
    } catch (err) {
      throw new LlmCallError(
        err instanceof Error ? err.message : String(err),
        failureReason(err),
        this.modelName,
      );
    }
  }
}
