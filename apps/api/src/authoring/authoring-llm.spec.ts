import {
  assertComplete,
  authoringModel,
  criticModel,
  formatCost,
  parseLlmJson,
} from './authoring-llm';

describe('authoring-llm', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('a blank model setting (as .env.example ships it) falls back to the default', () => {
    process.env['LLM_AUTHORING_MODEL'] = '';
    process.env['LLM_CRITIC_MODEL'] = '  ';
    expect(authoringModel()).toBe('claude-opus-4-8');
    expect(criticModel()).toBe('claude-haiku-4-5');
    process.env['LLM_AUTHORING_MODEL'] = 'claude-opus-5-5';
    expect(authoringModel()).toBe('claude-opus-5-5');
  });

  it('prices known models (dated ids included) and says so for unknown ones', () => {
    // 10k in × $5 + 4k out × $25 per million.
    expect(formatCost('claude-opus-4-8', 10_000, 4_000)).toBe('~$0.1500');
    expect(formatCost('claude-haiku-4-5-20251001', 1_000_000, 0)).toBe(
      '~$1.0000',
    );
    expect(formatCost('mystery-model', 1, 1)).toBe(
      'cost unknown for mystery-model',
    );
  });

  it('a reply cut off at max_tokens is reported as such, not as bad JSON', () => {
    expect(() =>
      assertComplete({ stop_reason: 'max_tokens' }, 'Skeleton', 16384),
    ).toThrow(/Skeleton hit the 16384-token output limit/);
    expect(() =>
      assertComplete({ stop_reason: 'end_turn' }, 'Skeleton', 16384),
    ).not.toThrow();
  });

  it('parses JSON through code fences or stray prose around it', () => {
    expect(parseLlmJson('```json\n{"a":1}\n```', 'X')).toEqual({ a: 1 });
    expect(
      parseLlmJson('Here is the skeleton:\n{"a":{"b":2}}\nDone.', 'X'),
    ).toEqual({ a: { b: 2 } });
    expect(() => parseLlmJson('I cannot do that.', 'Critic')).toThrow(
      /Critic returned non-JSON output/,
    );
  });
});
