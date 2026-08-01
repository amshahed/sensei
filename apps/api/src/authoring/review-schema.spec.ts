import { buildReviewTemplate, parseReviewFile } from './review-schema';
import { CRITIQUE_CHECKLIST } from './lesson-schema';
import type { LessonDraft } from './lesson-schema';

const MINIMAL_DRAFT: LessonDraft = {
  lessonId: 'foundation-ja-ch01-l01',
  lessonType: 'F-Kana',
  title: 'The Five Vowels',
  targetItemIds: ['ja:kana:a', 'ja:kana:i'],
  teach: {
    blocks: [
      { type: 'text', text: 'Vowels. Hiragana starts here.' },
      { type: 'audio', src: 'audio/kana/a.mp3', label: 'あ' },
    ],
  },
  practice: {
    templates: [
      { targetItemId: 'ja:kana:a', mode: 'recognition' },
      { targetItemId: 'ja:kana:i', mode: 'recall' },
    ],
  },
  check: {
    questions: [
      {
        id: 'q1',
        targetItemId: 'ja:kana:a',
        prompt: 'What sound is あ?',
        answerType: 'multiple-choice',
        choices: ['a', 'i', 'u', 'e'],
        correctAnswer: 'a',
      },
    ],
  },
  meta: {
    generatedAt: new Date().toISOString(),
    model: 'claude-opus-4-8',
    tokenUsage: { inputTokens: 200, outputTokens: 400 },
  },
};

// ── buildReviewTemplate ────────────────────────────────────────────────────────

describe('buildReviewTemplate', () => {
  it('includes lessonId and lessonType in header', () => {
    const out = buildReviewTemplate(MINIMAL_DRAFT);
    expect(out).toContain('foundation-ja-ch01-l01');
    expect(out).toContain('F-Kana');
  });

  it('includes DECISION: APPROVE line', () => {
    const out = buildReviewTemplate(MINIMAL_DRAFT);
    expect(out).toContain('DECISION: APPROVE');
  });

  it('includes all 9 CRITIQUE_CHECKLIST items as unchecked', () => {
    const out = buildReviewTemplate(MINIMAL_DRAFT);
    for (const name of CRITIQUE_CHECKLIST) {
      expect(out).toContain(`- [ ] ${name}`);
    }
    // checklist items in the template should all be unchecked
    expect(out).not.toMatch(/^- \[x\]/m);
  });

  it('includes teach block preview', () => {
    const out = buildReviewTemplate(MINIMAL_DRAFT);
    expect(out).toContain('[text]');
    expect(out).toContain('[audio]');
    expect(out).toContain('audio/kana/a.mp3');
  });

  it('includes check question preview', () => {
    const out = buildReviewTemplate(MINIMAL_DRAFT);
    expect(out).toContain('What sound is あ?');
    expect(out).toContain('multiple-choice');
  });

  it('includes Notes section', () => {
    const out = buildReviewTemplate(MINIMAL_DRAFT);
    expect(out).toContain('## Notes');
  });
});

// ── parseReviewFile ────────────────────────────────────────────────────────────

function makeReviewFile(overrides: {
  decision?: string;
  checklist?: string;
  notes?: string;
}): string {
  const decision = overrides.decision ?? 'DECISION: APPROVE';
  const checklist =
    overrides.checklist ??
    CRITIQUE_CHECKLIST.map((name) => `- [ ] ${name}`).join('\n');
  const notes = overrides.notes ?? '';
  return `# Header comment\n\n${decision}\n\n## Checklist\n\n${checklist}\n\n## Notes\n\n${notes}\n`;
}

describe('parseReviewFile', () => {
  it('parses APPROVE decision', () => {
    const result = parseReviewFile(
      makeReviewFile({}),
      'foundation-ja-ch01-l01',
    );
    expect(result.decision).toBe('APPROVE');
    expect(result.lessonId).toBe('foundation-ja-ch01-l01');
  });

  it('parses SEND_BACK decision', () => {
    const result = parseReviewFile(
      makeReviewFile({ decision: 'DECISION: SEND_BACK' }),
      'foundation-ja-ch01-l01',
    );
    expect(result.decision).toBe('SEND_BACK');
  });

  it('throws when DECISION is missing', () => {
    const content = makeReviewFile({ decision: '# no decision here' });
    expect(() => parseReviewFile(content, 'foundation-ja-ch01-l01')).toThrow(
      /DECISION/,
    );
  });

  it('parses all checklist items as pass when unchecked', () => {
    const result = parseReviewFile(
      makeReviewFile({}),
      'foundation-ja-ch01-l01',
    );
    expect(result.checks).toHaveLength(CRITIQUE_CHECKLIST.length);
    for (const c of result.checks) {
      expect(c.pass).toBe(true);
    }
  });

  it('parses [x] items as fail', () => {
    const checklist = CRITIQUE_CHECKLIST.map((name, i) =>
      i === 0 ? `- [x] ${name}` : `- [ ] ${name}`,
    ).join('\n');
    const result = parseReviewFile(
      makeReviewFile({ checklist }),
      'foundation-ja-ch01-l01',
    );
    expect(result.checks[0].pass).toBe(false);
    expect(result.checks[1].pass).toBe(true);
  });

  it('parses inline notes on fail items', () => {
    const checklist = `- [x] tone — needs more warmth\n- [ ] length`;
    const result = parseReviewFile(
      makeReviewFile({ checklist }),
      'foundation-ja-ch01-l01',
    );
    expect(result.checks[0].pass).toBe(false);
    expect(result.checks[0].note).toBe('needs more warmth');
    expect(result.checks[1].note).toBeUndefined();
  });

  it('extracts notes section content', () => {
    const result = parseReviewFile(
      makeReviewFile({ notes: 'Overall needs revision.' }),
      'foundation-ja-ch01-l01',
    );
    expect(result.notes).toBe('Overall needs revision.');
  });

  it('returns empty notes when section is empty', () => {
    const result = parseReviewFile(
      makeReviewFile({}),
      'foundation-ja-ch01-l01',
    );
    expect(result.notes).toBe('');
  });

  it('strips HTML comments from notes', () => {
    const result = parseReviewFile(
      makeReviewFile({ notes: '<!-- placeholder -->' }),
      'foundation-ja-ch01-l01',
    );
    expect(result.notes).toBe('');
  });

  it('throws when no checklist items found', () => {
    const content = 'DECISION: APPROVE\n\n## Notes\n\n';
    expect(() => parseReviewFile(content, 'foundation-ja-ch01-l01')).toThrow(
      /No checklist items found/,
    );
  });

  it('round-trips with buildReviewTemplate', () => {
    const template = buildReviewTemplate(MINIMAL_DRAFT);
    const result = parseReviewFile(template, MINIMAL_DRAFT.lessonId);
    expect(result.lessonId).toBe('foundation-ja-ch01-l01');
    expect(result.decision).toBe('APPROVE');
    expect(result.checks).toHaveLength(CRITIQUE_CHECKLIST.length);
    for (const c of result.checks) {
      expect(c.pass).toBe(true);
    }
  });
});
