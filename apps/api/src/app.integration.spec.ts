import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import type {
  CheckResultDto,
  CurriculumDto,
  LessonCompletionDto,
  LessonDetailDto,
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
  data: { romaji: 'a' },
};

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
  return {
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
      findMany: () =>
        Promise.resolve(
          lessonRow.items.map(({ item }) => ({ lessonId: lessonRow.id, item })),
        ),
    },
    userChapterMark: {
      findMany: () => Promise.resolve([]),
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
    },
    user: {
      upsert: ({ create }: { create: { id: string } }) =>
        Promise.resolve(create),
      findUnique: () => Promise.resolve(null),
      updateMany: () => Promise.resolve({ count: 0 }),
    },
    lessonCompletion: {
      findMany: ({ where: { userId } }: { where: { userId: string } }) =>
        Promise.resolve(
          completions
            .filter((c) => c.userId === userId)
            .map(({ lessonId }) => ({ lessonId })),
        ),
      upsert: ({
        where,
      }: {
        where: { userId_lessonId: { userId: string; lessonId: string } };
      }) => {
        const { userId, lessonId } = where.userId_lessonId;
        const row = { userId, lessonId, completedAt: new Date() };
        completions.push(row);
        return Promise.resolve(row);
      },
    },
    itemMasteryState: {
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
      findMany: () => Promise.resolve([]),
    },
  };
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
    expect(body.nextLesson).toEqual({
      slug: 'the-five-vowels',
      title: 'The Five Vowels あいうえお',
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
      nextLesson: {
        slug: 'the-five-vowels',
        title: 'The Five Vowels あいうえお',
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

  it('GET /curriculum reflects that completion (chapter completed, nothing next)', async () => {
    const res = await request(app.getHttpServer())
      .get('/curriculum')
      .set(DEV_USER_HEADER, 'user_int_test')
      .expect(200);
    const body = res.body as CurriculumDto;

    expect(body.modules[0].chapters[0].state).toBe('completed');
    expect(body.modules[0].chapters[0].lessons[0].state).toBe('completed');
    expect(body.nextLesson).toBeNull();
  });
});
