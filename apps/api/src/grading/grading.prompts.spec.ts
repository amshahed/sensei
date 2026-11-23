import { GRADING_SYSTEM } from './grading.prompts';

/**
 * The rules the open-check eval was run against (B.2.d). A change here needs
 * the recall and open-check evals re-run, so the exact wording is pinned.
 */
describe('GRADING_SYSTEM (B.2.d, P2, P4)', () => {
  it('asks for at most one thing to add or fix', () => {
    expect(GRADING_SYSTEM).toContain(
      '- Keep feedback to ONE short sentence: what was right, then at most ONE thing to add or fix. Never list several; if more than one is missing or wrong, name only the most useful one.',
    );
  });

  it('makes the feedback agree with the rating', () => {
    expect(GRADING_SYSTEM).toContain(
      '- The feedback agrees with the rating: no praise when the rating is "Again", and never call the answer wrong when it is "Hard" or better.',
    );
    expect(GRADING_SYSTEM).toContain('- Encouraging, never harsh.');
  });

  it('no longer carries the old feedback rule', () => {
    expect(GRADING_SYSTEM).not.toContain('the single most useful correction');
  });

  it('shows a short introduction passed with one thing to add', () => {
    expect(GRADING_SYSTEM).toContain(
      [
        'Q: Introduce yourself in Japanese: a greeting, your name, and what you do.',
        'Answer: hajimemashite. sam desu.',
        'Exemplar: はじめまして。サム です。がくせい です。',
        '→ {"rating":"Hard","feedback":"Good greeting and name; next time add what you do, like がくせい です."}',
      ].join('\n'),
    );
  });

  it('keeps the examples valid against the rating set', () => {
    const ratings = [...GRADING_SYSTEM.matchAll(/"rating":"(\w+)"/g)].map(
      (m) => m[1],
    );
    expect(ratings).toEqual(['Good', 'Hard', 'Again', 'Hard']);
  });
});
