/**
 * Thin internal LLM abstraction (decisions L.4 / L.4.a). Everything that talks
 * to a model goes through this seam so the provider is swappable per task.
 * Runtime grading uses GeminiLlmClient (default in model-defaults.ts, L.4.b).
 * Offline authoring uses AnthropicLlmClient directly via CLI scripts (Opus
 * drafter / Haiku critic), not through this DI token.
 */

/** Which kind of work a call is for — drives model tiering (L.4). */
export type LlmTask = 'grading' | 'authoring';

export interface ParseJsonOptions {
  task: LlmTask;
  /** Stable instruction prefix — cached when `cacheSystem` is set (G.3/F.5). */
  system: string;
  /** Volatile per-request content (e.g. the learner's answer). */
  user: string;
  /** JSON Schema the response is constrained to (structured outputs). */
  schema: Record<string, unknown>;
  schemaName: string;
  maxTokens?: number;
  /** Cache the system prefix (prompt caching) — on for repeated grading prompts. */
  cacheSystem?: boolean;
}

export interface LlmClient {
  /** False when no API key is configured — callers fall back deterministically. */
  readonly enabled: boolean;
  /** Run a structured-output completion and return the parsed JSON. */
  parseJson<T>(opts: ParseJsonOptions): Promise<T>;
}

/** Why a model call failed, so a lost model can be told apart from a busy one. */
export type LlmFailureReason =
  | 'model_unavailable'
  | 'rate_limited'
  | 'timeout'
  | 'provider_error';

/** A model call the provider failed, classified. `message` is the provider's. */
export class LlmCallError extends Error {
  constructor(
    message: string,
    readonly reason: LlmFailureReason,
    readonly model: string,
  ) {
    super(message);
    this.name = 'LlmCallError';
  }
}

/** DI token for the active LlmClient implementation. */
export const LLM_CLIENT = 'LLM_CLIENT';
