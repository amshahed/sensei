import {
  LessonDraftSchema,
  CritiqueSchema,
  CRITIQUE_CHECKLIST,
} from './lesson-schema';

const MINIMAL_DRAFT = {
  lessonId: 'foundation-ja-ch01-l01',
  lessonType: 'F-Kana',
  title: 'The Five Vowels',
  targetItemIds: ['ja:kana:a', 'ja:kana:i'],
  teach: {
    blocks: [
      {
        type: 'text',
        text: 'Introduction. Hiragana vowels are the foundation.',
      },
      {
        type: 'example',
        japanese: 'あ',
        reading: 'a',
        translation: 'the vowel "a"',
      },
      {
        type: 'mnemonic',
        text: 'あ looks like a person with arms outstretched saying "ah!"',
      },
      { type: 'audio', src: 'audio/kana/a.mp3', label: 'あ' },
    ],
  },
  practice: {
    templates: [
      { targetItemId: 'ja:kana:a', mode: 'recognition' },
      {
        targetItemId: 'ja:kana:i',
        mode: 'recall',
        hint: 'Think of the letter "e"',
      },
    ],
  },
  check: {
    questions: [
      {
        id: 'q1',
        targetItemId: 'ja:kana:a',
        prompt: 'What sound does あ make?',
        answerType: 'multiple-choice',
        choices: ['a', 'i', 'u', 'e'],
        correctAnswer: 'a',
        explanation: 'あ is pronounced "a" as in "father".',
      },
      {
        id: 'q2',
        targetItemId: 'ja:kana:i',
        prompt: 'Type the reading of い.',
        answerType: 'typed',
        correctAnswer: 'i',
      },
    ],
  },
  meta: {
    generatedAt: new Date().toISOString(),
    model: 'claude-opus-4-8',
    tokenUsage: { inputTokens: 500, outputTokens: 800 },
  },
};

const MINIMAL_CRITIQUE = {
  lessonId: 'foundation-ja-ch01-l01',
  checks: CRITIQUE_CHECKLIST.map((name) => ({ name, pass: true })),
  overallPass: true,
  summary: 'Well-structured kana lesson.',
  meta: {
    generatedAt: new Date().toISOString(),
    model: 'claude-haiku-4-5-20251001',
    tokenUsage: { inputTokens: 100, outputTokens: 50 },
  },
};

describe('LessonDraftSchema', () => {
  it('validates a well-formed draft', () => {
    expect(() => LessonDraftSchema.parse(MINIMAL_DRAFT)).not.toThrow();
  });

  it('rejects an invalid lesson type', () => {
    expect(() =>
      LessonDraftSchema.parse({ ...MINIMAL_DRAFT, lessonType: 'X-Invalid' }),
    ).toThrow();
  });

  it('rejects empty targetItemIds', () => {
    expect(() =>
      LessonDraftSchema.parse({ ...MINIMAL_DRAFT, targetItemIds: [] }),
    ).toThrow();
  });

  it('rejects a teach block with unknown type', () => {
    const bad = {
      ...MINIMAL_DRAFT,
      teach: { blocks: [{ type: 'unknown', content: 'x' }] },
    };
    expect(() => LessonDraftSchema.parse(bad)).toThrow();
  });

  it('rejects missing meta.generatedAt', () => {
    const bad = {
      ...MINIMAL_DRAFT,
      meta: { ...MINIMAL_DRAFT.meta, generatedAt: undefined },
    };
    expect(() => LessonDraftSchema.parse(bad)).toThrow();
  });

  it('rejects invalid datetime in meta.generatedAt', () => {
    const bad = {
      ...MINIMAL_DRAFT,
      meta: { ...MINIMAL_DRAFT.meta, generatedAt: 'not-a-date' },
    };
    expect(() => LessonDraftSchema.parse(bad)).toThrow();
  });

  it('rejects answerType outside enum', () => {
    const bad = {
      ...MINIMAL_DRAFT,
      check: {
        questions: [
          {
            ...MINIMAL_DRAFT.check.questions[0],
            answerType: 'drawing',
          },
        ],
      },
    };
    expect(() => LessonDraftSchema.parse(bad)).toThrow();
  });

  it('accepts optional fields (choices, explanation, hint) as absent', () => {
    const minimal = {
      ...MINIMAL_DRAFT,
      practice: {
        templates: [{ targetItemId: 'ja:kana:a', mode: 'recognition' }],
      },
      check: {
        questions: [
          {
            id: 'q1',
            targetItemId: 'ja:kana:a',
            prompt: 'What is this?',
            answerType: 'typed',
            correctAnswer: 'a',
          },
        ],
      },
    };
    expect(() => LessonDraftSchema.parse(minimal)).not.toThrow();
  });
});

describe('CritiqueSchema', () => {
  it('validates a well-formed critique', () => {
    expect(() => CritiqueSchema.parse(MINIMAL_CRITIQUE)).not.toThrow();
  });

  it('accepts checks with notes on failing items', () => {
    const critique = {
      ...MINIMAL_CRITIQUE,
      checks: [{ name: 'tone', pass: false, note: 'Too academic' }],
      overallPass: false,
    };
    expect(() => CritiqueSchema.parse(critique)).not.toThrow();
  });

  it('rejects missing lessonId', () => {
    const bad = { ...MINIMAL_CRITIQUE, lessonId: undefined };
    expect(() => CritiqueSchema.parse(bad)).toThrow();
  });

  it('rejects empty checks array', () => {
    const bad = { ...MINIMAL_CRITIQUE, checks: [] };
    expect(() => CritiqueSchema.parse(bad)).toThrow();
  });
});

describe('CRITIQUE_CHECKLIST', () => {
  it('has exactly 9 items', () => {
    expect(CRITIQUE_CHECKLIST).toHaveLength(9);
  });

  it('includes all expected checklist names', () => {
    expect(CRITIQUE_CHECKLIST).toContain('tone');
    expect(CRITIQUE_CHECKLIST).toContain('lesson-type-adherence');
    expect(CRITIQUE_CHECKLIST).toContain('learner-confusion');
  });
});
