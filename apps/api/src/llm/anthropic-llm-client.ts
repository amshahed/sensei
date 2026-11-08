import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { LlmClient, LlmTask, ParseJsonOptions } from './llm-client';
import {
  DEFAULT_AUTHORING_MODEL,
  DEFAULT_GRADING_MODEL,
  modelOrDefault,
} from './model-defaults';

/**
 * Minimal structural view of the Anthropic SDK surface we use. Keeping the seam
 * loose lets tests inject a fake without the SDK's strict request types, while
 * production passes the real client through.
 */
export interface AnthropicLike {
  messages: {
    create(body: unknown): Promise<{
      content: Array<{ type: string; text?: string }>;
      stop_reason?: string | null;
      usage?: { input_tokens?: number; output_tokens?: number };
    }>;
  };
}

/** Per-task model tiering (L.4): cheap/fast at runtime, capable for authoring. */
const DEFAULT_MODELS: Record<LlmTask, string> = {
  grading: DEFAULT_GRADING_MODEL,
  authoring: DEFAULT_AUTHORING_MODEL,
};

@Injectable()
export class AnthropicLlmClient implements LlmClient {
  private readonly logger = new Logger(AnthropicLlmClient.name);
  private readonly client: AnthropicLike | null;

  constructor(
    private readonly config: ConfigService,
    /**
     * Test seam: inject a fake client instead of hitting the network.
     * `@Optional()` is required so Nest's DI doesn't try to resolve this
     * non-injectable param — without it the app fails to construct at boot.
     */
    @Optional() client?: AnthropicLike,
  ) {
    if (client) {
      this.client = client;
    } else {
      const apiKey = config.get<string>('ANTHROPIC_API_KEY');
      this.client = apiKey ? new Anthropic({ apiKey }) : null;
    }
    if (!this.client) {
      this.logger.warn(
        'ANTHROPIC_API_KEY not set — AI authoring disabled (drafting/critique will fail without a key).',
      );
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  private modelFor(task: LlmTask): string {
    const override =
      task === 'authoring'
        ? this.config.get<string>('LLM_AUTHORING_MODEL')
        : this.config.get<string>('LLM_GRADING_MODEL');
    return modelOrDefault(override, DEFAULT_MODELS[task]);
  }

  async parseJson<T>(opts: ParseJsonOptions): Promise<T> {
    if (!this.client) {
      throw new Error('LLM client is not configured (no ANTHROPIC_API_KEY).');
    }

    const systemBlock: Record<string, unknown> = {
      type: 'text',
      text: opts.system,
    };
    if (opts.cacheSystem) {
      // Cache the stable instruction + few-shot prefix; the volatile answer in
      // the user turn sits after it and is never cached (prompt-caching rules).
      systemBlock.cache_control = { type: 'ephemeral' };
    }

    const maxTokens = opts.maxTokens ?? 1024;
    const res = await this.client.messages.create({
      model: this.modelFor(opts.task),
      max_tokens: maxTokens,
      system: [systemBlock],
      messages: [{ role: 'user', content: opts.user }],
      output_config: {
        format: {
          type: 'json_schema',
          name: opts.schemaName,
          schema: opts.schema,
        },
      },
    });

    const text = res.content.find(
      (b): b is { type: string; text: string } =>
        b.type === 'text' && typeof b.text === 'string',
    )?.text;

    if (res.stop_reason === 'max_tokens') {
      throw new Error(
        `LLM reply hit the ${maxTokens}-token limit, so its JSON was cut off.`,
      );
    }
    if (!text) {
      throw new Error('LLM returned no text content to parse.');
    }
    return JSON.parse(text) as T;
  }
}
