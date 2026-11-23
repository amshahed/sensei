import { keepOrder, mulberry32, reversing } from '../testing/random';
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
  const { checks } = toLessonDetailDto(lesson, keepOrder);

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
    expect(JSON.stringify(toLessonDetailDto(lesson, keepOrder))).not.toMatch(
      /kippu|is a ticket|ハナ|gives a name|full introduction/,
    );
  });

  it('marks only the open check open (B.2.d)', () => {
    expect(checks.filter((c) => c.open).map((c) => c.id)).toEqual(['chk-open']);
  });
});

describe('toLessonDetailDto: multiple-choice options come in a fresh order (B.2.e, P8)', () => {
  const stored = () =>
    (lesson.checks[0].data as { choices: string[] }).choices.slice();
  const choicesOf = (random: () => number) =>
    toLessonDetailDto(lesson, random).checks.find((c) => c.id === 'chk-mc')!
      .choices;

  it("are the generator's permutation of the stored options", () => {
    expect(choicesOf(reversing(4))).toEqual([
      'magazine',
      'school',
      'stamp',
      'ticket',
    ]);
    expect(choicesOf(keepOrder)).toEqual(stored());
  });

  it('differ between two mappings with different generators', () => {
    expect(choicesOf(reversing(4))).not.toEqual(choicesOf(keepOrder));
  });

  it('put the answer in every slot across showings', () => {
    const random = mulberry32(76);
    const slots = new Set<number>();
    for (let n = 0; n < 50; n++)
      slots.add(choicesOf(random)!.indexOf('ticket'));
    expect([...slots].sort()).toEqual([0, 1, 2, 3]);
  });

  it('never reorder the stored options', () => {
    const before = stored();
    choicesOf(reversing(4));
    choicesOf(mulberry32(3));
    expect(stored()).toEqual(before);
  });

  it('still carry no answer, and typed and open checks still have no choices', () => {
    const { checks } = toLessonDetailDto(lesson, reversing(4));
    for (const check of checks) expect(check).not.toHaveProperty('answer');
    expect(checks.find((c) => c.id === 'chk-typed')).not.toHaveProperty(
      'choices',
    );
    expect(checks.find((c) => c.id === 'chk-open')).not.toHaveProperty(
      'choices',
    );
  });
});
