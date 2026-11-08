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
    ).toThrow(
      'Skeleton hit the 16384-token output limit, so its reply was cut off.',
    );
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

  it('does not call a cut-off reply JSON: grammar references are plain text', () => {
    expect(() =>
      assertComplete({ stop_reason: 'max_tokens' }, 'Grammar reference', 512),
    ).not.toThrow(/JSON/);
  });

  it('finds the object even when the prose around it has braces', () => {
    const reply = [
      "I'll fill each {targetItemId}:",
      '```json',
      '{"lessonId":"l1","items":[{"id":"a"}]}',
      '```',
      'Note: checked all }',
    ].join('\n');
    expect(parseLlmJson(reply, 'X')).toEqual({
      lessonId: 'l1',
      items: [{ id: 'a' }],
    });
    // Unfenced, with a stray brace before and after.
    expect(parseLlmJson('Using {x} slots: {"a":1} — done }', 'X')).toEqual({
      a: 1,
    });
  });

  describe('when the reply holds more than one candidate', () => {
    it('takes the correction when the model sends two fenced objects', () => {
      const reply = [
        '```json',
        '{"overallPass":true}',
        '```',
        'Wait, check 4 fails. Corrected:',
        '```json',
        '{"overallPass":false}',
        '```',
      ].join('\n');
      expect(parseLlmJson(reply, 'Critic')).toEqual({ overallPass: false });
    });

    it('takes the real object after a small example object', () => {
      const reply = 'Shape is {"id":"example"}. Mine: {"id":"real"}';
      expect(parseLlmJson(reply, 'X')).toEqual({ id: 'real' });
    });

    it.each([8, 9, 40])(
      'is not defeated by %i placeholders before the object',
      (count) => {
        const reply = `${'{slot} '.repeat(count)}\n{"a":{"b":2}}`;
        expect(parseLlmJson(reply, 'X')).toEqual({ a: { b: 2 } });
      },
    );

    it.each([7, 8, 40])(
      'is not defeated by %i stray closing braces after the object',
      (count) => {
        const reply = `{"a":{"b":2}}\n${'} '.repeat(count)}`;
        expect(parseLlmJson(reply, 'X')).toEqual({ a: { b: 2 } });
      },
    );

    it('never returns a fragment of a malformed object', () => {
      expect(() =>
        parseLlmJson('{"a": oops, "b": {"c":1}}', 'Drafter'),
      ).toThrow(/Drafter returned non-JSON output/);
    });
  });

  describe('reading the object itself', () => {
    it('ignores braces and escaped quotes inside its strings', () => {
      const value = 'use } and { here, "quoted" \\ too';
      const reply = `Here you go: ${JSON.stringify({ a: value })} — done`;
      expect(parseLlmJson(reply, 'X')).toEqual({ a: value });
    });

    it('survives a stray opening brace that never closes', () => {
      expect(parseLlmJson('Open { here. {"a":1}', 'X')).toEqual({ a: 1 });
    });

    it('survives a stray quote inside a placeholder', () => {
      expect(parseLlmJson('Replace {"name} with {"a":1}', 'X')).toEqual({
        a: 1,
      });
    });

    it('still returns a reply that is JSON but not an object', () => {
      expect(parseLlmJson('[1,2]', 'X')).toEqual([1, 2]);
    });
  });
});
