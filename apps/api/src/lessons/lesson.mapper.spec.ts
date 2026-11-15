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
  ],
} as unknown as LessonWithRelations;

describe('toLessonDetailDto: a check is sent without what gives it away (B.2.b, P1)', () => {
  const { checks } = toLessonDetailDto(lesson);

  it.each(['answer', 'explanation', 'answerForms', 'data'])(
    'has no %s key on any check',
    (key) => {
      for (const check of checks) expect(check).not.toHaveProperty(key);
    },
  );

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
    ]);
  });

  it('never carries the explanation text anywhere in the payload', () => {
    expect(JSON.stringify(toLessonDetailDto(lesson))).not.toMatch(
      /kippu|is a ticket/,
    );
  });
});
