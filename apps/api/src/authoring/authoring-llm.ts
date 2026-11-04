/**
 * Shared plumbing for the authoring CLIs' Claude calls (L.4/L.4.a): which
 * model, what it cost, and turning the reply into JSON.
 */

export const DEFAULT_AUTHORING_MODEL = 'claude-opus-4-8';
export const DEFAULT_CRITIC_MODEL = 'claude-haiku-4-5';

/**
 * A blank value (as `.env.example` ships `LLM_AUTHORING_MODEL=`) means "use
 * the default", not "send an empty model name".
 */
const fromEnv = (name: string, fallback: string): string =>
  process.env[name]?.trim() || fallback;

/** The drafting model (skeleton, lesson drafts, grammar references). */
export const authoringModel = (): string =>
  fromEnv('LLM_AUTHORING_MODEL', DEFAULT_AUTHORING_MODEL);
/** The critic model. */
export const criticModel = (): string =>
  fromEnv('LLM_CRITIC_MODEL', DEFAULT_CRITIC_MODEL);

/** Anthropic list prices, USD per million tokens: [input, output]. */
const PRICES: Record<string, [number, number]> = {
  'claude-opus-4-8': [5, 25],
  'claude-haiku-4-5': [1, 5],
};

/** "~$0.1234", or a note when the model's price isn't in the table. */
export function formatCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): string {
  const key = Object.keys(PRICES).find(
    (k) => model === k || model.startsWith(`${k}-`),
  );
  if (!key) return `cost unknown for ${model}`;
  const [inPrice, outPrice] = PRICES[key];
  const usd = (inputTokens * inPrice + outputTokens * outPrice) / 1_000_000;
  return `~$${usd.toFixed(4)}`;
}

/**
 * A reply cut off at `max_tokens` is truncated JSON: say so plainly instead
 * of letting it surface as a parse error.
 */
export function assertComplete(
  res: { stop_reason?: string | null },
  label: string,
  maxTokens: number,
): void {
  if (res.stop_reason === 'max_tokens') {
    throw new Error(
      `${label} hit the ${maxTokens}-token output limit, so its JSON was cut off. Raise max_tokens or split the request.`,
    );
  }
}

/**
 * Parse the model's JSON. Tolerates code fences and stray prose around the
 * object (models without extended thinking sometimes reason aloud first).
 */
export function parseLlmJson(raw: string, label: string): unknown {
  const text = raw
    .trim()
    .replace(/^```[\w]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as unknown;
      } catch {
        // fall through to the error below
      }
    }
    throw new Error(
      `${label} returned non-JSON output (first 200 chars): ${text.slice(0, 200)}`,
    );
  }
}
