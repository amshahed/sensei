/**
 * Shared plumbing for the authoring CLIs' Claude calls (L.4/L.4.a): which
 * model, what it cost, and turning the reply into JSON.
 */
import {
  DEFAULT_AUTHORING_MODEL,
  DEFAULT_CRITIC_MODEL,
  modelOrDefault,
} from '../llm/model-defaults';

export { DEFAULT_AUTHORING_MODEL, DEFAULT_CRITIC_MODEL };

/** The drafting model (skeleton, lesson drafts, grammar references). */
export const authoringModel = (): string =>
  modelOrDefault(process.env['LLM_AUTHORING_MODEL'], DEFAULT_AUTHORING_MODEL);
/** The critic model. */
export const criticModel = (): string =>
  modelOrDefault(process.env['LLM_CRITIC_MODEL'], DEFAULT_CRITIC_MODEL);

/**
 * Client timeout for the authoring CLIs. Long, one-off, non-streaming calls;
 * setting it explicitly also stops the SDK refusing a large `max_tokens` on
 * models it caps lower for non-streaming requests.
 */
export const AUTHORING_TIMEOUT_MS = 15 * 60_000;

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
 * A reply cut off at `max_tokens` is unfinished, whether it was JSON or a
 * plain-text passage: say so plainly instead of letting it surface as a parse
 * error or get kept half-written.
 */
export function assertComplete(
  res: { stop_reason?: string | null },
  label: string,
  maxTokens: number,
): void {
  if (res.stop_reason === 'max_tokens') {
    throw new Error(
      `${label} hit the ${maxTokens}-token output limit, so its reply was cut off. Raise max_tokens or split the request.`,
    );
  }
}

/**
 * Parse the model's JSON: the whole reply if it is JSON, otherwise the last
 * complete top-level object in it. Models without extended thinking sometimes
 * reason aloud, so code fences and prose (braces included) can surround the
 * object, and a model that corrects itself ends with the correction.
 */
export function parseLlmJson(raw: string, label: string): unknown {
  const text = raw.trim();
  for (const candidate of [text, ...topLevelObjects(text).reverse()]) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // try the next one
    }
  }
  throw new Error(
    `${label} returned non-JSON output (first 200 chars): ${text.slice(0, 200)}`,
  );
}

/**
 * Every balanced `{...}` span at the top level of the text, in order. A
 * balanced span is never searched inside, because a fragment of a malformed
 * object isn't the answer. A `{` that never closes is stray prose, so the
 * scan moves on to the next one.
 */
function topLevelObjects(text: string): string[] {
  const spans: string[] = [];
  let start = text.indexOf('{');
  while (start !== -1) {
    const end = closingBrace(text, start);
    if (end !== -1) spans.push(text.slice(start, end + 1));
    start = text.indexOf('{', (end === -1 ? start : end) + 1);
  }
  return spans;
}

/** Index of the `}` closing the `{` at `start`, or -1. Skips JSON strings. */
function closingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}' && --depth === 0) {
      return i;
    }
  }
  return -1;
}
