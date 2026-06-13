/**
 * Thin internal LLM abstraction (decisions L.4). Everything that talks to a
 * model goes through this seam so the provider is swappable and model choice is
 * per-task (cheap/fast at runtime, capable at authoring time). The only
 * implementation today is Anthropic (see anthropic-llm-client.ts).
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

/** DI token for the active LlmClient implementation. */
export const LLM_CLIENT = 'LLM_CLIENT';
