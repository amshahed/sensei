import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Schema as GeminiSchema } from '@google/generative-ai';
import type { LlmClient, ParseJsonOptions } from './llm-client';

/**
 * Minimal structural view of the Gemini SDK surface we use. Keeping the seam
 * loose lets tests inject a fake without the SDK's strict request types, while
 * production passes the real GenerativeModel through.
 */
export interface GeminiModelLike {
  generateContent(request: {
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    systemInstruction?: string;
    generationConfig?: Record<string, unknown>;
  }): Promise<{ response: { text(): string } }>;
}

const DEFAULT_MODEL = 'gemini-2.5-flash';

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
export class GeminiLlmClient implements LlmClient {
  private readonly logger = new Logger(GeminiLlmClient.name);
  private readonly model: GeminiModelLike | null;

  constructor(
    private readonly config: ConfigService,
    /**
     * Test seam: inject a fake model instead of hitting the network.
     * `@Optional()` prevents Nest from failing to resolve this interface type at boot.
     */
    @Optional() model?: GeminiModelLike,
  ) {
    if (model) {
      this.model = model;
    } else {
      const apiKey = config.get<string>('GEMINI_API_KEY');
      if (apiKey) {
        const modelName =
          config.get<string>('LLM_GRADING_MODEL') || DEFAULT_MODEL;
        const genAI = new GoogleGenerativeAI(apiKey);
        this.model = genAI.getGenerativeModel({ model: modelName });
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

    const result = await this.model.generateContent({
      contents: [{ role: 'user', parts: [{ text: opts.user }] }],
      systemInstruction: opts.system,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(opts.schema) as unknown as GeminiSchema,
        maxOutputTokens: opts.maxTokens ?? 1024,
      },
    });

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
    return JSON.parse(text) as T;
  }
}
