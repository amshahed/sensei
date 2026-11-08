/**
 * Default Claude models per job (L.4 tiering, L.4.a split) — one place, read
 * by both the NestJS LLM client and the authoring CLIs.
 */
export const DEFAULT_GRADING_MODEL = 'claude-haiku-4-5';
export const DEFAULT_AUTHORING_MODEL = 'claude-opus-4-8';
export const DEFAULT_CRITIC_MODEL = 'claude-haiku-4-5';

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
