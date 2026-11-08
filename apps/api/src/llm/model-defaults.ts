/**
 * Default models per job (L.4 tiering, L.4.a split, L.4.b) — one place, read
 * by the NestJS LLM clients and the authoring CLIs.
 */
/** The Anthropic client's grading model. Runtime grading uses the Gemini one. */
export const DEFAULT_GRADING_MODEL = 'claude-haiku-4-5';
export const DEFAULT_AUTHORING_MODEL = 'claude-opus-4-8';
export const DEFAULT_CRITIC_MODEL = 'claude-haiku-4-5';
/** Runtime grading (L.4.b). `gemini-3.1-flash-lite` is the tested manual switch. */
export const DEFAULT_GEMINI_GRADING_MODEL = 'gemini-3.5-flash-lite';

/**
 * A configured model, or the default when it's unset *or blank* — `.env`
 * files ship `LLM_AUTHORING_MODEL=` empty, and `??` would send model "".
 */
export function modelOrDefault(
  configured: string | undefined | null,
  fallback: string,
): string {
  return configured?.trim() || fallback;
}
