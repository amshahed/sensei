import { toLessonDetailDto, type LessonWithRelations } from './lesson.mapper';

/** A lesson as Prisma returns it, with a check carrying everything it stores. */
const lesson = {
  id: 'lesson-1',
  slug: 'foundation-ja-ch04-l05',
  title: 'Small っ',
  type: 'F_VOCAB',
  position: 19,
  estimatedMinutes: 7,
  teach: { blocks: [] },
  chapter: {
    id: 'ch-4',
    title: 'Sounds',
    module: { id: 'mod-1', title: 'Foundation (Japanese)' },
  },
  items: [],
  checks: [
    {
      id: 'chk-mc',
      position: 0,
      prompt: 'Which is きっぷ?',
      format: 'MULTIPLE_CHOICE',
      targetItemId: 'ja:vocab:切符',
      data: {
        choices: ['ticket', 'stamp', 'school', 'magazine'],
        answer: 'ticket',
        explanation: 'きっぷ is a ticket.',
      },
    },
    {
      id: 'chk-typed',
      position: 1,
      prompt: 'Read this word and type how it sounds: きっぷ',
      format: 'TYPED',
      targetItemId: 'ja:vocab:切符',
      data: {
        answer: 'きっぷ',
        explanation: 'In rōmaji, きっぷ is kippu: the っ doubles the p.',
      },
    },
    {
      id: 'chk-open',
      position: 2,
      prompt: 'Now write your own short self-introduction.',
      format: 'TYPED',
      targetItemId: 'ja:grammar:です',
      data: {
        exemplar: 'はじめまして。わたし の なまえ は ハナ です。',
        rubric: 'Pass any self-introduction that gives a name.',
        explanation: 'A full introduction runs: はじめまして → なまえ.',
      },
    },
    {
      id: 'chk-mc-broken',
      position: 3,
      prompt: 'Which is ねこ?',
      format: 'MULTIPLE_CHOICE',
      targetItemId: 'ja:vocab:猫',
      data: { choices: ['cat', 'dog'], answer: '' },
    },
  ],
} as unknown as LessonWithRelations;

describe('toLessonDetailDto: a check is sent without what gives it away (B.2.b, P1)', () => {
  const { checks } = toLessonDetailDto(lesson);

  it.each([
    'answer',
    'exemplar',
    'rubric',
    'explanation',
    'answerForms',
    'data',
  ])('has no %s key on any check', (key) => {
    for (const check of checks) expect(check).not.toHaveProperty(key);
  });

  it('sends what the learner needs to answer, and nothing more', () => {
    expect(checks).toEqual([
      {
        id: 'chk-mc',
        position: 0,
        prompt: 'Which is きっぷ?',
        format: 'MULTIPLE_CHOICE',
        targetItemId: 'ja:vocab:切符',
        choices: ['ticket', 'stamp', 'school', 'magazine'],
      },
      {
        id: 'chk-typed',
        position: 1,
        prompt: 'Read this word and type how it sounds: きっぷ',
        format: 'TYPED',
        targetItemId: 'ja:vocab:切符',
      },
      {
        id: 'chk-open',
        position: 2,
        prompt: 'Now write your own short self-introduction.',
        format: 'TYPED',
        targetItemId: 'ja:grammar:です',
        open: true,
      },
      {
        id: 'chk-mc-broken',
        position: 3,
        prompt: 'Which is ねこ?',
        format: 'MULTIPLE_CHOICE',
        targetItemId: 'ja:vocab:猫',
        choices: ['cat', 'dog'],
      },
    ]);
  });

  it('never carries the explanation, model answer or rubric anywhere in the payload', () => {
    expect(JSON.stringify(toLessonDetailDto(lesson))).not.toMatch(
      /kippu|is a ticket|ハナ|gives a name|full introduction/,
    );
  });

  it('marks only the open check open (B.2.d)', () => {
    expect(checks.filter((c) => c.open).map((c) => c.id)).toEqual(['chk-open']);
  });
});
