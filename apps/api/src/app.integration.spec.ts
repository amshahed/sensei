import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import type {
  AssessmentResultDto,
  AssessmentStartDto,
  CheckResultDto,
  CurriculumDto,
  LessonCompletionDto,
  LessonDetailDto,
  OnboardingDto,
  PlacementAnswerDto,
  PlacementResultDto,
  PlacementStartDto,
  PracticeResultDto,
  PracticeScopesDto,
  RemindersDto,
  StreakDto,
  PracticeSessionDto,
  ReviewResultDto,
} from '@sensei/types';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { DEV_USER_HEADER } from './auth/dev-user';

/**
 * HTTP-level integration test: boots the real AppModule (controllers, pipes,
 * the @CurrentUserId decorator, DTO serialization, and the real grading → FSRS
 * services) over an in-memory Prisma fake. Covers the seams the service unit
 * tests (which call methods directly) can't: routing, the header → user
 * resolution, and answer-stripping on the wire. No database required.
 */

const kanaA = {
  id: 'ja:kana:a',
  language: 'ja',
  type: 'KANA',
  display: 'あ',
  reading: 'あ',
  meaning: null,
  data: { romaji: 'a', script: 'hiragana' },
};

/** Other hiragana: distractors for placement's kana question. */
const kanaPool = [
  kanaA,
  ...(
    [
      ['い', 'i'],
      ['う', 'u'],
      ['え', 'e'],
      ['お', 'o'],
    ] as const
  ).map(([display, romaji]) => ({
    ...kanaA,
    id: `ja:kana:${romaji}`,
    display,
    reading: display,
    data: { romaji, script: 'hiragana' },
  })),
];

const lessonRow = {
  id: 'lesson-1',
  slug: 'the-five-vowels',
  title: 'The Five Vowels あいうえお',
  type: 'F_KANA',
  position: 1,
  estimatedMinutes: 5,
  teach: { blocks: [{ kind: 'heading', text: 'The Five Vowels' }] },
  chapter: {
    id: 'ch-1',
    title: 'Hiragana — Vowels',
    module: { id: 'mod-1', title: 'Foundation (Japanese)' },
  },
  items: [
    {
      role: 'TARGET',
      item: {
        id: 'ja:kana:a',
        language: 'ja',
        type: 'KANA',
        display: 'あ',
        reading: 'あ',
        meaning: null,
      },
    },
  ],
  checks: [
    {
      id: 'chk-1',
      position: 0,
      prompt: 'Which kana is read “a”?',
      format: 'MULTIPLE_CHOICE',
      targetItemId: 'ja:kana:a',
      data: { choices: ['あ', 'い', 'う'], answer: 'あ' },
    },
  ],
};

/** Minimal in-memory stand-in for the Prisma surface the routes touch. */
function fakePrisma() {
  const masteryStates = new Map<string, Record<string, unknown>>();
  const completions: Array<{
    userId: string;
    lessonId: string;
    completedAt: Date;
  }> = [];
  const marks = new Map<string, { chapterId: string; kind: string }>();
  const attempts = new Map<string, Record<string, unknown>>();
  const practiceSessions = new Map<string, Record<string, unknown>>();
  const practiceAttempts = new Set<string>();
  const lessonItems = [
    {
      lessonId: lessonRow.id,
      itemId: kanaA.id,
      role: 'TARGET',
      position: 0,
      item: kanaA,
      lesson: {
        position: 1,
        chapterId: lessonRow.chapter.id,
        chapter: {
          id: lessonRow.chapter.id,
          title: lessonRow.chapter.title,
          position: 1,
          module: { ...lessonRow.chapter.module, position: 1 },
        },
      },
    },
  ];
  const users = new Map<string, Record<string, unknown>>();
  const placements = new Map<string, Record<string, unknown>>();
  const studyDays = new Map<string, Record<string, unknown>>();
  /** Prisma-style `where` equality (null matches a missing value). */
  const matches = (row: Record<string, unknown>, where: object) =>
    Object.entries(where).every(([k, v]) =>
      v === null ? row[k] == null : row[k] === v,
    );
  const fake: Record<string, unknown> = {
    // Interactive transactions run against the same in-memory fake.
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(fake),
    $queryRaw: () => Promise.resolve([]),
    module: {
      findMany: () =>
        Promise.resolve([
          {
            id: lessonRow.chapter.module.id,
            slug: 'foundation-ja',
            title: lessonRow.chapter.module.title,
            position: 1,
            chapters: [
              {
                id: lessonRow.chapter.id,
                slug: 'hiragana-vowels',
                title: lessonRow.chapter.title,
                position: 1,
                lessons: [
                  {
                    id: lessonRow.id,
                    slug: lessonRow.slug,
                    title: lessonRow.title,
                    type: lessonRow.type,
                    position: lessonRow.position,
                    estimatedMinutes: lessonRow.estimatedMinutes,
                  },
                ],
              },
            ],
          },
        ]),
    },
    lessonItem: {
      // Real Prisma applies `select`; the fake returns the full row.
      findMany: ({ where }: { where?: { itemId?: { in: string[] } } } = {}) =>
        Promise.resolve(
          lessonItems.filter(
            (r) => !where?.itemId || where.itemId.in.includes(r.itemId),
          ),
        ),
    },
    chapter: {
      findUnique: ({ where: { id } }: { where: { id: string } }) =>
        Promise.resolve(
          id === lessonRow.chapter.id
            ? { id, title: lessonRow.chapter.title }
            : null,
        ),
      findMany: () => Promise.resolve([{ id: lessonRow.chapter.id }]),
    },
    placementAttempt: {
      findUnique: ({ where }: { where: { id?: string; userId?: string } }) =>
        Promise.resolve(
          [...placements.values()].find((p) => matches(p, where)) ?? null,
        ),
      findUniqueOrThrow: ({ where: { id } }: { where: { id: string } }) =>
        Promise.resolve(placements.get(id)),
      create: ({ data }: { data: Record<string, unknown> }) => {
        const id = `pl-${placements.size + 1}`;
        const row = {
          id,
          status: 'IN_PROGRESS',
          answers: [],
          answered: 0,
          startChapterId: null,
          completedAt: null,
          ...data,
        };
        placements.set(id, row);
        return Promise.resolve(row);
      },
      updateMany: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = placements.get(where.id);
        if (!row || !matches(row, where)) return Promise.resolve({ count: 0 });
        placements.set(where.id, { ...row, ...data });
        return Promise.resolve({ count: 1 });
      },
    },
    practiceSession: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        const id = `ps-${practiceSessions.size + 1}`;
        practiceSessions.set(id, { id, ...data });
        return Promise.resolve({ id });
      },
      findUnique: ({ where: { id } }: { where: { id: string } }) =>
        Promise.resolve(practiceSessions.get(id) ?? null),
    },
    practiceAttempt: {
      createMany: ({
        data: [row],
      }: {
        data: Array<{ sessionId: string; itemId: string }>;
      }) => {
        const key = `${row.sessionId}:${row.itemId}`;
        if (practiceAttempts.has(key)) return Promise.resolve({ count: 0 });
        practiceAttempts.add(key);
        return Promise.resolve({ count: 1 });
      },
      deleteMany: () => Promise.resolve({ count: 0 }),
    },
    userLessonSkip: {
      findMany: () => Promise.resolve([]),
      createMany: ({ data }: { data: unknown[] }) =>
        Promise.resolve({ count: data.length }),
    },
    userChapterMark: {
      createMany: ({
        data,
      }: {
        data: Array<{ userId: string; chapterId: string; kind: string }>;
      }) => {
        let count = 0;
        for (const m of data) {
          const key = `${m.userId}:${m.chapterId}`;
          if (marks.has(key)) continue;
          marks.set(key, { chapterId: m.chapterId, kind: m.kind });
          count++;
        }
        return Promise.resolve({ count });
      },
      count: ({ where }: { where: { userId: string; kind: string } }) =>
        Promise.resolve(
          [...marks].filter(
            ([key, m]) =>
              key.startsWith(`${where.userId}:`) && m.kind === where.kind,
          ).length,
        ),
      findMany: ({ where: { userId } }: { where: { userId: string } }) =>
        Promise.resolve(
          [...marks]
            .filter(([key]) => key.startsWith(`${userId}:`))
            .map(([, m]) => m),
        ),
      upsert: ({
        where: { userId_chapterId: k },
        create,
      }: {
        where: { userId_chapterId: { userId: string; chapterId: string } };
        create: { chapterId: string; kind: string };
      }) => {
        marks.set(`${k.userId}:${k.chapterId}`, {
          chapterId: create.chapterId,
          kind: create.kind,
        });
        return Promise.resolve(create);
      },
    },
    assessmentAttempt: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        const id = `att-${attempts.size + 1}`;
        attempts.set(id, {
          id,
          status: 'IN_PROGRESS',
          createdAt: new Date(),
          correctCount: null,
          results: null,
          ...data,
        });
        return Promise.resolve({ id });
      },
      findUnique: ({ where: { id } }: { where: { id: string } }) =>
        Promise.resolve(attempts.get(id) ?? null),
      updateMany: ({
        where: { id, status },
        data,
      }: {
        where: { id: string; status: string };
        data: Record<string, unknown>;
      }) => {
        const row = attempts.get(id);
        if (!row || row.status !== status) return Promise.resolve({ count: 0 });
        attempts.set(id, { ...row, ...data });
        return Promise.resolve({ count: 1 });
      },
    },
    lesson: {
      findFirst: () => Promise.resolve(lessonRow),
    },
    check: {
      findUnique: ({ where: { id } }: { where: { id: string } }) =>
        Promise.resolve(lessonRow.checks.find((c) => c.id === id) ?? null),
    },
    item: {
      findUnique: ({ where: { id } }: { where: { id: string } }) =>
        Promise.resolve(id === kanaA.id ? kanaA : null),
      // By id (assessments) or by type (placement's distractor pool).
      findMany: ({ where }: { where: { id?: { in: string[] } } }) =>
        Promise.resolve(
          where.id ? (where.id.in.includes(kanaA.id) ? [kanaA] : []) : kanaPool,
        ),
    },
    user: {
      upsert: ({
        create,
        update,
      }: {
        create: { id: string };
        update: Record<string, unknown>;
      }) => {
        const existing = users.get(create.id);
        const row = existing
          ? { ...existing, ...update }
          : {
              createdAt: new Date(),
              interests: [],
              streakFreezes: 0,
              // Schema defaults for reminders (K.3.g).
              remindersOn: false,
              reminderMinute: 1080,
              eveningReminder: true,
              quietStartMinute: 1320,
              quietEndMinute: 480,
              remindersAskedAt: null,
              ...create,
            };
        users.set(create.id, row);
        return Promise.resolve(row);
      },
      findUnique: ({ where: { id } }: { where: { id: string } }) => {
        const row = users.get(id);
        if (!row) return Promise.resolve(null);
        const attempt = [...placements.values()].find((p) => p.userId === id);
        return Promise.resolve({ ...row, placementAttempt: attempt ?? null });
      },
      update: ({
        where: { id },
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = { ...users.get(id), ...data };
        users.set(id, row);
        return Promise.resolve(row);
      },
      updateMany: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = users.get(where.id);
        if (!row || !matches(row, where)) return Promise.resolve({ count: 0 });
        users.set(where.id, { ...row, ...data });
        return Promise.resolve({ count: 1 });
      },
    },
    lessonCompletion: {
      findFirst: ({ where: { userId } }: { where: { userId: string } }) =>
        Promise.resolve(completions.find((c) => c.userId === userId) ?? null),
      findMany: ({ where: { userId } }: { where: { userId: string } }) =>
        Promise.resolve(
          completions
            .filter((c) => c.userId === userId)
            .map(({ lessonId }) => ({ lessonId })),
        ),
      createMany: ({
        data: [row],
      }: {
        data: Array<{ userId: string; lessonId: string }>;
      }) => {
        if (
          completions.some(
            (c) => c.userId === row.userId && c.lessonId === row.lessonId,
          )
        ) {
          return Promise.resolve({ count: 0 });
        }
        completions.push({ ...row, completedAt: new Date() });
        return Promise.resolve({ count: 1 });
      },
      findUniqueOrThrow: ({
        where: { userId_lessonId: k },
      }: {
        where: { userId_lessonId: { userId: string; lessonId: string } };
      }) =>
        Promise.resolve(
          completions.find(
            (c) => c.userId === k.userId && c.lessonId === k.lessonId,
          ),
        ),
      update: ({
        where: { userId_lessonId: k },
        data,
      }: {
        where: { userId_lessonId: { userId: string; lessonId: string } };
        data: { completedAt: Date };
      }) => {
        const row = completions.find(
          (c) => c.userId === k.userId && c.lessonId === k.lessonId,
        )!;
        row.completedAt = data.completedAt;
        return Promise.resolve(row);
      },
    },
    studyDay: {
      findUnique: ({
        where: { userId_localDate: k },
      }: {
        where: { userId_localDate: { userId: string; localDate: string } };
      }) =>
        Promise.resolve(studyDays.get(`${k.userId}:${k.localDate}`) ?? null),
      upsert: ({
        where: { userId_localDate: k },
        create,
        update,
      }: {
        where: { userId_localDate: { userId: string; localDate: string } };
        create: Record<string, unknown>;
        update: Record<string, { increment: number }>;
      }) => {
        const key = `${k.userId}:${k.localDate}`;
        const row = studyDays.get(key);
        const next = row
          ? {
              ...row,
              effortSeconds:
                (row.effortSeconds as number) + update.effortSeconds.increment,
              reviewsAnswered:
                (row.reviewsAnswered as number) +
                update.reviewsAnswered.increment,
            }
          : {
              effortSeconds: 0,
              reviewsAnswered: 0,
              done: false,
              doneAt: null,
              frozen: false,
              freezeEarned: false,
              ...create,
            };
        studyDays.set(key, next);
        return Promise.resolve(next);
      },
      updateMany: ({
        where,
        data,
      }: {
        where: { userId: string; localDate: string };
        data: Record<string, unknown>;
      }) => {
        const key = `${where.userId}:${where.localDate}`;
        const row = studyDays.get(key);
        if (!row || !matches(row, where)) return Promise.resolve({ count: 0 });
        studyDays.set(key, { ...row, ...data });
        return Promise.resolve({ count: 1 });
      },
      findMany: ({ where: { userId } }: { where: { userId: string } }) =>
        Promise.resolve(
          [...studyDays.values()]
            .filter((d) => d.userId === userId)
            .sort((a, b) =>
              (b.localDate as string).localeCompare(a.localDate as string),
            ),
        ),
    },
    itemMasteryState: {
      createMany: ({
        data,
      }: {
        data: Array<
          Record<string, unknown> & { userId: string; itemId: string }
        >;
      }) => {
        let count = 0;
        for (const row of data) {
          const key = `${row.userId}:${row.itemId}`;
          if (masteryStates.has(key)) continue;
          masteryStates.set(key, {
            recognition: 0,
            recall: 0,
            production: 0,
            ...row,
          });
          count++;
        }
        return Promise.resolve({ count });
      },
      findFirst: ({
        where,
      }: {
        where: { userId: string; itemId: string; due?: { lte: Date } };
      }) => {
        const row = masteryStates.get(`${where.userId}:${where.itemId}`) as
          | { due?: Date | null }
          | undefined;
        const due = row?.due ?? null;
        return Promise.resolve(
          row && (!where.due || (due !== null && due <= where.due.lte))
            ? row
            : null,
        );
      },
      findUnique: ({
        where,
      }: {
        where: { userId_itemId: { userId: string; itemId: string } };
      }) => {
        const { userId, itemId } = where.userId_itemId;
        return Promise.resolve(
          masteryStates.get(`${userId}:${itemId}`) ?? null,
        );
      },
      upsert: ({
        where,
        create,
      }: {
        where: { userId_itemId: { userId: string; itemId: string } };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const { userId, itemId } = where.userId_itemId;
        const row = { recognition: 0, recall: 0, production: 0, ...create };
        masteryStates.set(`${userId}:${itemId}`, row);
        return Promise.resolve(row);
      },
      // Joined with the (only) item; real Prisma applies select/include.
      findMany: ({
        where,
      }: {
        where: {
          userId: string;
          itemId?: { in: string[] };
          due?: { lte: Date };
        };
      }) =>
        Promise.resolve(
          [...masteryStates]
            .filter(([key]) => key.startsWith(`${where.userId}:`))
            .map(([key, row]) => ({
              ...row,
              itemId: key.slice(where.userId.length + 1),
              item: kanaA,
            }))
            .filter((r) => !where.itemId || where.itemId.in.includes(r.itemId))
            .filter(
              (r) => !where.due || (r as { due?: Date }).due! <= where.due.lte,
            ),
        ),
    },
  };
  return fake;
}

describe('API (HTTP integration)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(fakePrisma())
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'sensei-api' });
  });

  it('GET /lessons/:slug returns the lesson and never leaks the check answer', async () => {
    const res = await request(app.getHttpServer())
      .get('/lessons/the-five-vowels')
      .expect(200);
    const body = res.body as LessonDetailDto;

    expect(body).toMatchObject({
      slug: 'the-five-vowels',
      type: 'F_KANA',
      module: { title: 'Foundation (Japanese)' },
    });
    expect(body.checks[0].choices).toEqual(['あ', 'い', 'う']);
    // The correct answer must not cross the wire.
    expect(body.checks[0]).not.toHaveProperty('answer');
    expect(JSON.stringify(body)).not.toContain('"answer"');
  });

  it('POST /checks/:id/answer grades a correct multiple-choice answer', async () => {
    const res = await request(app.getHttpServer())
      .post('/checks/chk-1/answer')
      .set(DEV_USER_HEADER, 'user_int_test')
      .send({ answer: 'あ' })
      .expect(201);

    expect(res.body).toEqual({
      checkId: 'chk-1',
      correct: true,
      correctAnswer: 'あ',
    });
  });

  it('POST /checks/:id/answer marks a wrong answer incorrect', async () => {
    const res = await request(app.getHttpServer())
      .post('/checks/chk-1/answer')
      .send({ answer: 'い' })
      .expect(201);

    expect((res.body as CheckResultDto).correct).toBe(false);
  });

  it('POST /checks/:id/answer 404s for an unknown check', async () => {
    await request(app.getHttpServer())
      .post('/checks/nope/answer')
      .send({ answer: 'あ' })
      .expect(404);
  });

  it('GET /curriculum returns the outline with the next lesson for a new learner', async () => {
    const res = await request(app.getHttpServer())
      .get('/curriculum')
      .set(DEV_USER_HEADER, 'user_curriculum_new')
      .expect(200);
    const body = res.body as CurriculumDto;

    expect(body.currentChapterId).toBe('ch-1');
    expect(body.next).toEqual({
      kind: 'lesson',
      slug: 'the-five-vowels',
      title: 'The Five Vowels あいうえお',
      chapterId: 'ch-1',
      chapterTitle: 'Hiragana — Vowels',
      chapterStart: true,
    });
    const chapter = body.modules[0].chapters[0];
    expect(chapter).toMatchObject({ state: 'current', lessonCount: 1 });
    expect(chapter.lessons[0]).toMatchObject({
      state: 'current',
      keyItems: [{ id: 'ja:kana:a', display: 'あ' }],
    });
    expect(body.relocated).toBe(false);
  });

  it('GET /curriculum/next returns just the next lesson', async () => {
    const res = await request(app.getHttpServer())
      .get('/curriculum/next')
      .set(DEV_USER_HEADER, 'user_curriculum_new')
      .expect(200);
    expect(res.body).toEqual({
      next: {
        kind: 'lesson',
        slug: 'the-five-vowels',
        title: 'The Five Vowels あいうえお',
        chapterId: 'ch-1',
        chapterTitle: 'Hiragana — Vowels',
        chapterStart: true,
      },
    });
  });

  it('POST /curriculum/relocate with chapterId null returns to the furthest point', async () => {
    const res = await request(app.getHttpServer())
      .post('/curriculum/relocate')
      .set(DEV_USER_HEADER, 'user_curriculum_new')
      .send({ chapterId: null })
      .expect(201);
    expect(res.body).toMatchObject({
      currentChapterId: 'ch-1',
      relocated: false,
    });
  });

  it('POST /curriculum/relocate 400s without a valid chapterId', async () => {
    for (const body of [{}, { chapterId: '' }, { chapterId: 42 }]) {
      await request(app.getHttpServer())
        .post('/curriculum/relocate')
        .send(body)
        .expect(400);
    }
  });

  it('POST /curriculum/relocate 404s for an unknown chapter', async () => {
    await request(app.getHttpServer())
      .post('/curriculum/relocate')
      .send({ chapterId: 'nope' })
      .expect(404);
  });

  it('POST /curriculum/relocate 400s for a chapter that was never skipped', async () => {
    await request(app.getHttpServer())
      .post('/curriculum/relocate')
      .send({ chapterId: 'ch-1' })
      .expect(400);
  });

  it('GET /reviews/due returns the (empty) due queue', async () => {
    const res = await request(app.getHttpServer())
      .get('/reviews/due')
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('POST /reviews/:itemId/answer grades typed recall against the item exemplar', async () => {
    // KANA → expected = rōmaji from data; "a" matches kanaA.data.romaji.
    const res = await request(app.getHttpServer())
      .post(`/reviews/${encodeURIComponent(kanaA.id)}/answer`)
      .send({ answer: 'A' }) // case-insensitive match
      .expect(201);
    const body = res.body as ReviewResultDto;

    expect(body.itemId).toBe(kanaA.id);
    expect(body.correct).toBe(true);
    expect(body.correctAnswer).toBe('a');
    expect(typeof body.mastery).toBe('number');
  });

  it('POST /reviews/:itemId/answer 404s for an unknown item', async () => {
    await request(app.getHttpServer())
      .post('/reviews/ja:kana:none/answer')
      .send({ answer: 'a' })
      .expect(404);
  });

  it('POST /lessons/:slug/complete records the completion for the dev user', async () => {
    const res = await request(app.getHttpServer())
      .post('/lessons/the-five-vowels/complete')
      .set(DEV_USER_HEADER, 'user_int_test')
      .expect(201);
    const body = res.body as LessonCompletionDto;

    expect(body.lessonId).toBe('lesson-1');
    expect(body.completed).toBe(true);
    // ISO-8601 timestamp.
    expect(() => new Date(body.completedAt).toISOString()).not.toThrow();
  });

  it('GET /curriculum reflects that completion (exit Assessment is next)', async () => {
    const res = await request(app.getHttpServer())
      .get('/curriculum')
      .set(DEV_USER_HEADER, 'user_int_test')
      .expect(200);
    const body = res.body as CurriculumDto;

    expect(body.modules[0].chapters[0].state).toBe('current');
    expect(body.modules[0].chapters[0].lessons[0].state).toBe('completed');
    expect(body.next).toEqual({
      kind: 'assessment',
      chapterId: 'ch-1',
      chapterTitle: 'Hiragana — Vowels',
    });
  });

  describe('chapter Assessment (I.4.d.a)', () => {
    const user = 'user_assessment';
    const startIt = () =>
      request(app.getHttpServer())
        .post('/chapters/ch-1/assessment')
        .set(DEV_USER_HEADER, user);

    let attemptId: string;

    it('POST /chapters/:id/assessment starts a skip-test without leaking answers', async () => {
      const res = await startIt().expect(201);
      const body = res.body as AssessmentStartDto;
      expect(body).toMatchObject({
        chapterId: 'ch-1',
        chapterTitle: 'Hiragana — Vowels',
        kind: 'SKIP',
        passThreshold: 0.8,
        questions: [
          { itemId: 'ja:kana:a', prompt: 'Type the rōmaji for 「あ」' },
        ],
      });
      expect(JSON.stringify(body)).not.toContain('"a"');
      attemptId = body.attemptId;
    });

    it('POST /chapters/:id/assessment 404s for an unknown chapter', async () => {
      await request(app.getHttpServer())
        .post('/chapters/nope/assessment')
        .set(DEV_USER_HEADER, user)
        .expect(404);
    });

    it('POST /assessments/:id/submit 400s on a malformed body', async () => {
      for (const body of [{}, { answers: 'a' }, { answers: [{ itemId: 1 }] }]) {
        await request(app.getHttpServer())
          .post(`/assessments/${attemptId}/submit`)
          .set(DEV_USER_HEADER, user)
          .send(body)
          .expect(400);
      }
    });

    it('POST /assessments/:id/submit 404s for another learner', async () => {
      await request(app.getHttpServer())
        .post(`/assessments/${attemptId}/submit`)
        .set(DEV_USER_HEADER, 'someone_else')
        .send({ answers: [] })
        .expect(404);
    });

    it('passing the skip-test completes the chapter', async () => {
      const res = await request(app.getHttpServer())
        .post(`/assessments/${attemptId}/submit`)
        .set(DEV_USER_HEADER, user)
        .send({ answers: [{ itemId: 'ja:kana:a', answer: 'a' }] })
        .expect(201);
      expect(res.body as AssessmentResultDto).toMatchObject({
        passed: true,
        correct: 1,
        total: 1,
        kind: 'SKIP',
        results: [{ itemId: 'ja:kana:a', correct: true, correctAnswer: 'a' }],
      });

      const outline = await request(app.getHttpServer())
        .get('/curriculum')
        .set(DEV_USER_HEADER, user)
        .expect(200);
      const body = outline.body as CurriculumDto;
      expect(body.modules[0].chapters[0].state).toBe('completed');
      expect(body.modules[0].chapters[0].lessons[0].state).toBe('skipped');
      expect(body.next).toBeNull();
    });

    it('a repeat submit replays the result; the passed chapter offers no new Assessment', async () => {
      const res = await request(app.getHttpServer())
        .post(`/assessments/${attemptId}/submit`)
        .set(DEV_USER_HEADER, user)
        .send({ answers: [{ itemId: 'ja:kana:a', answer: 'wrong now' }] })
        .expect(201);
      expect(res.body as AssessmentResultDto).toMatchObject({
        passed: true,
        correct: 1,
        results: [{ itemId: 'ja:kana:a', answer: 'a', correct: true }],
      });
      await startIt().expect(400);
    });
  });

  describe('Practice Mode (J.1)', () => {
    const user = 'user_practice';
    const post = (path: string, body: unknown) =>
      request(app.getHttpServer())
        .post(path)
        .set(DEV_USER_HEADER, user)
        .send(body as object);

    it('a learner with nothing learned has nothing to drill', async () => {
      const outline = await request(app.getHttpServer())
        .get('/curriculum')
        .set(DEV_USER_HEADER, user)
        .expect(200);
      expect(
        (outline.body as CurriculumDto).modules[0].chapters[0].actions.practice,
      ).toBe(false);

      const res = await request(app.getHttpServer())
        .get('/practice/scopes')
        .set(DEV_USER_HEADER, user)
        .expect(200);
      expect(res.body).toEqual({
        learned: { KANA: 0, VOCAB: 0, KANJI: 0, GRAMMAR: 0 },
        modules: [],
      });
      const start = await post('/practice/sessions', {
        scope: { kind: 'weakest' },
      }).expect(201);
      expect(start.body).toEqual({ sessionId: null, items: [] });
    });

    it('POST /practice/sessions 400s on a malformed scope', async () => {
      for (const body of [
        {},
        { scope: { kind: 'random' } },
        { scope: { kind: 'chapter' } },
        { scope: { kind: 'weakest' }, types: ['VERB'] },
      ]) {
        await post('/practice/sessions', body).expect(400);
      }
    });

    it('POST /practice/sessions 404s for an unknown chapter', async () => {
      await post('/practice/sessions', {
        scope: { kind: 'chapter', id: 'nope' },
      }).expect(404);
    });

    describe('after learning an item', () => {
      let sessionId: string;

      beforeAll(async () => {
        // A review answer creates the learner's mastery record for あ.
        await post(`/reviews/${encodeURIComponent(kanaA.id)}/answer`, {
          answer: 'a',
        }).expect(201);
      });

      it('GET /practice/scopes lists it under its module and chapter', async () => {
        const res = await request(app.getHttpServer())
          .get('/practice/scopes')
          .set(DEV_USER_HEADER, user)
          .expect(200);
        const body = res.body as PracticeScopesDto;
        expect(body.learned.KANA).toBe(1);
        expect(body.modules).toEqual([
          {
            id: 'mod-1',
            title: 'Foundation (Japanese)',
            learned: { KANA: 1, VOCAB: 0, KANJI: 0, GRAMMAR: 0 },
            chapters: [
              {
                id: 'ch-1',
                title: 'Hiragana — Vowels',
                learned: { KANA: 1, VOCAB: 0, KANJI: 0, GRAMMAR: 0 },
              },
            ],
          },
        ]);
      });

      it('the Curriculum Outline offers to practise the chapter', async () => {
        const res = await request(app.getHttpServer())
          .get('/curriculum')
          .set(DEV_USER_HEADER, user)
          .expect(200);
        const body = res.body as CurriculumDto;
        expect(body.modules[0].chapters[0].actions.practice).toBe(true);
      });

      it('POST /practice/sessions drills the chapter without leaking answers', async () => {
        const res = await post('/practice/sessions', {
          scope: { kind: 'chapter', id: 'ch-1' },
          types: ['KANA'],
        }).expect(201);
        const body = res.body as PracticeSessionDto;
        expect(body.items).toEqual([
          {
            itemId: kanaA.id,
            type: 'KANA',
            display: 'あ',
            prompt: 'Type the rōmaji for 「あ」',
          },
        ]);
        expect(JSON.stringify(body)).not.toContain('"a"');
        sessionId = body.sessionId!;
      });

      it('the first answer counts; a repeat in the same session is practice only', async () => {
        const answer = (a: string) =>
          post(`/practice/sessions/${sessionId}/answer`, {
            itemId: kanaA.id,
            answer: a,
          }).expect(201);

        const first = (await answer('a')).body as PracticeResultDto;
        expect(first).toMatchObject({
          itemId: kanaA.id,
          correct: true,
          correctAnswer: 'a',
          scored: true,
          counted: true,
        });

        const repeat = (await answer('i')).body as PracticeResultDto;
        expect(repeat).toMatchObject({ correct: false, counted: false });
        expect(repeat.mastery).toBe(first.mastery);
      });

      it('answer 400s on a malformed body or an item outside the session', async () => {
        await post(`/practice/sessions/${sessionId}/answer`, {
          itemId: kanaA.id,
        }).expect(400);
        await post(`/practice/sessions/${sessionId}/answer`, {
          itemId: 'ja:kana:i',
          answer: 'i',
        }).expect(400);
      });

      it("answer 404s for another learner's session", async () => {
        await request(app.getHttpServer())
          .post(`/practice/sessions/${sessionId}/answer`)
          .set(DEV_USER_HEADER, 'someone_else')
          .send({ itemId: kanaA.id, answer: 'a' })
          .expect(404);
      });
    });
  });

  describe('signup intake + placement (I.3.b, I.4.f)', () => {
    const as = (user: string) => ({
      get: (path: string) =>
        request(app.getHttpServer()).get(path).set(DEV_USER_HEADER, user),
      post: (path: string, body?: object) =>
        request(app.getHttpServer())
          .post(path)
          .set(DEV_USER_HEADER, user)
          .send(body),
    });

    it('a new learner owes the survey first; placement 400s until then', async () => {
      const u = as('user_onboard_new');
      const res = await u.get('/onboarding').expect(200);
      expect(res.body).toEqual({ intakeDone: false, placement: 'not_needed' });
      await u.post('/placement').expect(400);
    });

    it('POST /onboarding/intake validates the three answers', async () => {
      const u = as('user_onboard_bad');
      for (const body of [
        {},
        { interests: [], priorExperience: 'NONE' },
        { interests: ['KARAOKE'], priorExperience: 'NONE' },
        { interests: ['TRAVEL'], priorExperience: 'EXPERT' },
        {
          interests: ['TRAVEL'],
          priorExperience: 'NONE',
          dailyTargetMinutes: 7,
        },
      ]) {
        await u.post('/onboarding/intake', body).expect(400);
      }
    });

    it('a total beginner skips placement entirely', async () => {
      const u = as('user_onboard_beginner');
      const res = await u
        .post('/onboarding/intake', {
          interests: ['TRAVEL', 'JLPT'],
          priorExperience: 'NONE',
        })
        .expect(201);
      expect(res.body as OnboardingDto).toEqual({
        intakeDone: true,
        placement: 'not_needed',
      });
      await u.post('/placement').expect(400);
      // The survey is taken once.
      await u
        .post('/onboarding/intake', {
          interests: ['TRAVEL'],
          priorExperience: 'NONE',
        })
        .expect(409);
    });

    describe('a learner who knows some kana', () => {
      const u = as('user_onboard_kana');
      let start: PlacementStartDto;

      it('is owed the kana placement after the survey', async () => {
        const res = await u
          .post('/onboarding/intake', {
            interests: ['ANIME_MANGA'],
            priorExperience: 'SOME_KANA',
            dailyTargetMinutes: 20,
          })
          .expect(201);
        expect(res.body).toEqual({ intakeDone: true, placement: 'pending' });
      });

      it('POST /placement asks multiple-choice kana without leaking answers', async () => {
        const res = await u.post('/placement').expect(201);
        start = res.body as PlacementStartDto;
        expect(start).toMatchObject({
          tier: 'KANA',
          answered: 0,
          result: null,
        });
        expect(start.questions).toHaveLength(1);
        const [q] = start.questions;
        expect(q).toMatchObject({
          itemId: kanaA.id,
          type: 'KANA',
          prompt: 'Which hiragana is read “a”?',
        });
        expect(q.parts[0].choices).toHaveLength(4);
        expect(q.parts[0].choices).toContain('あ');
        expect(JSON.stringify(start)).not.toContain('"answer"');
        expect(JSON.stringify(start)).not.toContain('chapterId');
        // Resuming returns the same attempt.
        const again = (await u.post('/placement').expect(201))
          .body as PlacementStartDto;
        expect(again.attemptId).toBe(start.attemptId);
      });

      it('answers are validated: offered choices only, in order', async () => {
        const path = `/placement/${start.attemptId}/answer`;
        await u.post(path, { itemId: kanaA.id, choices: ['ん'] }).expect(400);
        await u.post(path, { itemId: kanaA.id, choices: 'あ' }).expect(400);
        await u.post(path, { itemId: 'ja:kana:i', choices: null }).expect(400);
        await as('someone_else')
          .post(path, { itemId: kanaA.id, choices: ['あ'] })
          .expect(404);
      });

      it('getting everything right places past the chapter and seeds what was tested', async () => {
        const res = await u
          .post(`/placement/${start.attemptId}/answer`, {
            itemId: kanaA.id,
            choices: ['あ'],
          })
          .expect(201);
        const body = res.body as PlacementAnswerDto;
        expect(body).toEqual({
          done: true,
          result: {
            status: 'COMPLETED',
            startChapter: null, // placed past everything published
            skippedChapterCount: 1,
            answered: 1,
          },
        });

        // Retrying the same answer replays the outcome.
        const replay = await u
          .post(`/placement/${start.attemptId}/answer`, {
            itemId: kanaA.id,
            choices: ['あ'],
          })
          .expect(201);
        expect(replay.body).toEqual(body);

        expect((await u.get('/onboarding').expect(200)).body).toEqual({
          intakeDone: true,
          placement: 'done',
        });
        const outline = (await u.get('/curriculum').expect(200))
          .body as CurriculumDto;
        const chapter = outline.modules[0].chapters[0];
        expect(chapter.state).toBe('skipped_via_placement');
        expect(chapter.lessons[0].state).toBe('skipped');
        // The correctly-answered kana now has FSRS state: drillable.
        expect(chapter.actions.practice).toBe(true);
        await u.post('/placement/skip').expect(409);
      });
    });

    it('"I don\'t know" on the first question starts at the beginning, nothing seeded', async () => {
      const u = as('user_onboard_unsure');
      await u
        .post('/onboarding/intake', {
          interests: ['CURIOUS'],
          priorExperience: 'FAIR_AMOUNT',
        })
        .expect(201);
      const start = (await u.post('/placement').expect(201))
        .body as PlacementStartDto;
      expect(start.tier).toBe('FULL');
      const res = await u
        .post(`/placement/${start.attemptId}/answer`, {
          itemId: start.questions[0].itemId,
          choices: null,
        })
        .expect(201);
      expect((res.body as PlacementAnswerDto).result).toEqual({
        status: 'COMPLETED',
        startChapter: { id: 'ch-1', title: 'Hiragana — Vowels' },
        skippedChapterCount: 0,
        answered: 1,
      });
      const outline = (await u.get('/curriculum').expect(200))
        .body as CurriculumDto;
      expect(outline.modules[0].chapters[0].state).toBe('current');
      expect(outline.modules[0].chapters[0].actions.practice).toBe(false);
    });

    it('a learner with progress from before onboarding takes the survey but is not placed', async () => {
      // user_int_test completed the-five-vowels earlier in this file.
      const u = as('user_int_test');
      expect((await u.get('/onboarding').expect(200)).body).toEqual({
        intakeDone: false,
        placement: 'not_needed',
      });
      const res = await u
        .post('/onboarding/intake', {
          interests: ['TRAVEL'],
          priorExperience: 'FAIR_AMOUNT',
        })
        .expect(201);
      expect(res.body).toEqual({ intakeDone: true, placement: 'not_needed' });
      await u.post('/placement').expect(400);
      await u.post('/placement/skip').expect(400);
    });

    it('POST /placement/skip starts from the beginning', async () => {
      const u = as('user_onboard_skip');
      await u
        .post('/onboarding/intake', {
          interests: ['LIVE_WORK'],
          priorExperience: 'REFRESHER',
        })
        .expect(201);
      const res = await u.post('/placement/skip').expect(201);
      expect(res.body as PlacementResultDto).toEqual({
        status: 'SKIPPED',
        startChapter: { id: 'ch-1', title: 'Hiragana — Vowels' },
        skippedChapterCount: 0,
        answered: 0,
      });
      // Idempotent, and placement is no longer owed.
      await u.post('/placement/skip').expect(201);
      expect((await u.get('/onboarding').expect(200)).body).toEqual({
        intakeDone: true,
        placement: 'done',
      });
    });
  });

  describe('learning streak (K.2, K.3.f)', () => {
    const user = 'user_streak';
    const get = () =>
      request(app.getHttpServer())
        .get('/streak?tz=Europe/Berlin')
        .set(DEV_USER_HEADER, user);

    // Signing in creates the learner's row (as the app's GET /me does), so
    // the first status read can store the timezone that days are counted in.
    beforeAll(() =>
      request(app.getHttpServer())
        .get('/me')
        .set(DEV_USER_HEADER, user)
        .expect(200),
    );

    it('a new learner starts at zero with the default target', async () => {
      const res = await get().expect(200);
      expect(res.body as StreakDto).toEqual({
        days: 0,
        today: {
          done: false,
          effortMinutes: 0,
          targetMinutes: 10,
          reviewsRemaining: 0,
        },
        freezes: 0,
        freezeCap: 2,
        suggestion: null,
      });
    });

    it('a completed lesson credits its estimated minutes, once', async () => {
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer())
          .post('/lessons/the-five-vowels/complete')
          .set(DEV_USER_HEADER, user)
          .expect(201);
      }
      const body = (await get().expect(200)).body as StreakDto;
      expect(body.today).toMatchObject({ effortMinutes: 5, done: false });
      expect(body.days).toBe(0);
    });

    it('PUT /streak/target validates, and a lower target completes the day', async () => {
      await request(app.getHttpServer())
        .put('/streak/target')
        .set(DEV_USER_HEADER, user)
        .send({ minutes: 7 })
        .expect(400);
      const res = await request(app.getHttpServer())
        .put('/streak/target')
        .set(DEV_USER_HEADER, user)
        .send({ minutes: 5 })
        .expect(200);
      expect(res.body as StreakDto).toMatchObject({
        days: 1,
        today: { done: true, effortMinutes: 5, targetMinutes: 5 },
      });
    });

    it('POST /streak/suggestion/dismiss returns the status', async () => {
      const res = await request(app.getHttpServer())
        .post('/streak/suggestion/dismiss')
        .set(DEV_USER_HEADER, user)
        .expect(201);
      expect((res.body as StreakDto).days).toBe(1);
    });
  });

  describe('reminders (K.3.d, K.3.g)', () => {
    const user = 'user_reminders';
    const http = () => request(app.getHttpServer());
    const get = () =>
      http().get('/reminders?tz=Europe/Berlin').set(DEV_USER_HEADER, user);
    const put = (body: object) =>
      http()
        .put('/reminders?tz=Europe/Berlin')
        .set(DEV_USER_HEADER, user)
        .send(body);

    it('start off, with no offer before a first completed lesson', async () => {
      const res = await get().expect(200);
      expect(res.body as RemindersDto).toEqual({
        settings: {
          on: false,
          minute: 1080,
          evening: true,
          quietStartMinute: 1320,
          quietEndMinute: 480,
        },
        offer: false,
        plan: [],
      });
    });

    it('PUT validates the settings', async () => {
      await put({}).expect(400);
      await put({ minute: 1440 }).expect(400);
      await put({ on: 'yes' }).expect(400);
      await put({ on: true, volume: 11 }).expect(400);
    });

    it('turning on returns a capped, future plan; one tap turns it off', async () => {
      const on = (await put({ on: true, minute: 8 * 60 }).expect(200))
        .body as RemindersDto;
      expect(on.settings).toMatchObject({ on: true, minute: 480 });
      expect(on.offer).toBe(false);
      expect(on.plan.length).toBeGreaterThan(0);
      expect(on.plan.length).toBeLessThanOrEqual(14);
      for (const r of on.plan) {
        expect(new Date(r.at).getTime()).toBeGreaterThan(Date.now());
        expect(['primary', 'lastCall']).toContain(r.kind);
      }
      expect((await get().expect(200)).body).toMatchObject({
        settings: { on: true },
      });

      const off = (await put({ on: false }).expect(200)).body as RemindersDto;
      expect(off.plan).toEqual([]);
    });
  });

  describe('the reminders offer', () => {
    const user = 'user_reminders_offer';
    const http = () => request(app.getHttpServer());

    it('is made after a first completed lesson, until answered', async () => {
      await http()
        .post('/lessons/the-five-vowels/complete')
        .set(DEV_USER_HEADER, user)
        .expect(201);
      const before = await http()
        .get('/reminders')
        .set(DEV_USER_HEADER, user)
        .expect(200);
      expect((before.body as RemindersDto).offer).toBe(true);
      const after = await http()
        .post('/reminders/offer/dismiss')
        .set(DEV_USER_HEADER, user)
        .expect(201);
      expect((after.body as RemindersDto).offer).toBe(false);
    });
  });
});
