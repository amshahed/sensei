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
 * Parse the model's JSON. Tolerates code fences (anywhere) and prose around
 * the object — models without extended thinking sometimes reason aloud —
 * even when that prose contains braces of its own.
 */
export function parseLlmJson(raw: string, label: string): unknown {
  const text = raw.trim();
  const candidates: string[] = [text];
  for (const m of text.matchAll(/```[\w-]*\s*\n?([\s\S]*?)```/g)) {
    candidates.push(m[1].trim());
  }
  // Every '{' that could open the object, against every '}' that could close
  // it — outermost spans first. Bounded so a huge reply can't explode this.
  const opens = indexesOf(text, '{').slice(0, 8);
  const closes = indexesOf(text, '}').reverse().slice(0, 8);
  for (const start of opens) {
    for (const end of closes) {
      if (end > start) candidates.push(text.slice(start, end + 1));
    }
  }
  for (const candidate of candidates) {
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

function indexesOf(text: string, ch: string): number[] {
  const out: number[] = [];
  for (let i = text.indexOf(ch); i !== -1; i = text.indexOf(ch, i + 1)) {
    out.push(i);
  }
  return out;
}
