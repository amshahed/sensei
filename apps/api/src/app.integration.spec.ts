import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { CheckResultDto, LessonDetailDto } from '@sensei/types';
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
  return {
    lesson: {
      findFirst: () => Promise.resolve(lessonRow),
    },
    check: {
      findUnique: ({ where: { id } }: { where: { id: string } }) =>
        Promise.resolve(lessonRow.checks.find((c) => c.id === id) ?? null),
    },
    user: {
      upsert: ({ create }: { create: { id: string } }) =>
        Promise.resolve(create),
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

  it('GET /reviews/due returns the (empty) due queue', async () => {
    const res = await request(app.getHttpServer())
      .get('/reviews/due')
      .expect(200);
    expect(res.body).toEqual([]);
  });
});
