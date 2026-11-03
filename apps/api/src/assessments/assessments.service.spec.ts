import {
  BadRequestException,
  ConflictException,
  GoneException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CurriculumService } from '../curriculum/curriculum.service';
import { GradingService } from '../grading/grading.service';
import { MasteryService } from '../mastery/mastery.service';
import { PrismaService } from '../prisma/prisma.service';
import { WritingEvalService } from '../writing-eval/writing-eval.service';
import {
  ASSESSMENT_RANDOM,
  ASSESSMENT_SAMPLE_SIZE,
  ASSESSMENT_TTL_MS,
  AssessmentsService,
} from './assessments.service';

const kana = (n: number) => ({
  id: `k${n}`,
  type: 'KANA',
  display: `か${n}`,
  reading: `か${n}`,
  meaning: null,
  data: { romaji: `ka${n}` },
});
const grammar = {
  id: 'g1',
  type: 'GRAMMAR',
  display: '〜ください',
  reading: null,
  meaning: 'please do',
  data: {},
};

/** Chapter c1: lesson l1 teaches k1,k2; l2 teaches k3,g1. */
const targets = [
  { lessonId: 'l1', item: kana(1) },
  { lessonId: 'l1', item: kana(2) },
  { lessonId: 'l2', item: kana(3) },
  { lessonId: 'l2', item: grammar },
];
const allItems = targets.map((t) => t.item);

function curriculumState({
  assessment = true,
  lessonsDone = false,
}: { assessment?: boolean; lessonsDone?: boolean } = {}) {
  return {
    modules: [
      {
        chapters: [
          {
            id: 'c1',
            title: 'Chapter 1',
            lessons: [{ id: 'l1' }, { id: 'l2' }],
          },
        ],
      },
    ],
    state: {
      chapterActions: new Map([
        ['c1', { relocate: false, assessment, review: false }],
      ]),
      lessonsDoneChapterIds: new Set(lessonsDone ? ['c1'] : []),
    },
  };
}

const aiGrade = (correct: boolean, over: Record<string, unknown> = {}) => ({
  rating: correct ? 'Good' : 'Again',
  correct,
  feedback: '',
  exemplar: 'please do',
  gradedBy: 'ai',
  scored: true,
  ...over,
});

describe('AssessmentsService', () => {
  let service: AssessmentsService;
  let getState: jest.Mock;
  let lessonItemFindMany: jest.Mock;
  let attemptCreate: jest.Mock;
  let attemptFindUnique: jest.Mock;
  let attemptUpdateMany: jest.Mock;
  let itemFindMany: jest.Mock;
  let markUpsert: jest.Mock;
  let userUpdateMany: jest.Mock;
  let skipCreateMany: jest.Mock;
  let recordCheckResult: jest.Mock;
  let seedInferred: jest.Mock;
  let gradeOpen: jest.Mock;

  beforeEach(async () => {
    getState = jest.fn().mockResolvedValue(curriculumState());
    lessonItemFindMany = jest.fn(
      ({ select }: { select: Record<string, unknown> }) =>
        Promise.resolve(
          'itemId' in select
            ? targets.map((t) => ({ lessonId: t.lessonId, itemId: t.item.id }))
            : targets,
        ),
    );
    attemptCreate = jest.fn().mockResolvedValue({ id: 'att-1' });
    attemptFindUnique = jest.fn();
    attemptUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    itemFindMany = jest.fn().mockResolvedValue(allItems);
    markUpsert = jest.fn().mockResolvedValue({});
    userUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
    skipCreateMany = jest.fn().mockResolvedValue({ count: 0 });
    recordCheckResult = jest.fn().mockResolvedValue({});
    seedInferred = jest.fn().mockResolvedValue(0);
    gradeOpen = jest.fn(({ answer }: { answer: string }) =>
      Promise.resolve(aiGrade(answer === 'please do')),
    );

    // `$transaction(fn)` runs fn against the same fake.
    const prisma: Record<string, unknown> = {
      lessonItem: { findMany: lessonItemFindMany },
      item: { findMany: itemFindMany },
      assessmentAttempt: {
        create: attemptCreate,
        findUnique: attemptFindUnique,
        updateMany: attemptUpdateMany,
      },
      user: {
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: userUpdateMany,
      },
      userChapterMark: { upsert: markUpsert },
      userLessonSkip: { createMany: skipCreateMany },
    };
    prisma.$transaction = (fn: (tx: unknown) => Promise<unknown>) => fn(prisma);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AssessmentsService,
        { provide: ASSESSMENT_RANDOM, useValue: () => 0.5 },
        { provide: CurriculumService, useValue: { getState } },
        {
          provide: MasteryService,
          useValue: { recordCheckResult, seedInferred },
        },
        { provide: GradingService, useValue: { gradeOpen } },
        {
          provide: WritingEvalService,
          useValue: { exactMatch: (a: string, b: string) => a === b },
        },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(AssessmentsService);
  });

  describe('start', () => {
    it('404s for an unknown chapter', async () => {
      await expect(service.start('u1', 'nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('400s when the chapter is locked or already passed', async () => {
      getState.mockResolvedValue(curriculumState({ assessment: false }));
      await expect(service.start('u1', 'c1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(attemptCreate).not.toHaveBeenCalled();
    });

    it('stores the sampled items server-side and never sends answers', async () => {
      const dto = await service.start('u1', 'c1');
      expect(dto).toMatchObject({
        attemptId: 'att-1',
        chapterId: 'c1',
        chapterTitle: 'Chapter 1',
        kind: 'SKIP', // lessons not done yet
        passThreshold: 0.8,
        autoPassed: false,
      });
      expect(dto.questions.map((q) => q.itemId).sort()).toEqual([
        'g1',
        'k1',
        'k2',
        'k3',
      ]);
      expect(JSON.stringify(dto)).not.toMatch(/ka1|please do/);
      expect(attemptCreate).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          chapterId: 'c1',
          kind: 'SKIP',
          itemIds: dto.questions.map((q) => q.itemId),
        },
        select: { id: true },
      });
    });

    it('is an EXIT Assessment once the chapter’s lessons are all done', async () => {
      getState.mockResolvedValue(curriculumState({ lessonsDone: true }));
      expect((await service.start('u1', 'c1')).kind).toBe('EXIT');
    });

    it(`samples at most ${ASSESSMENT_SAMPLE_SIZE} items`, async () => {
      const many = Array.from({ length: 30 }, (_, i) => ({
        lessonId: i % 2 ? 'l1' : 'l2',
        item: kana(i + 10),
      }));
      lessonItemFindMany.mockResolvedValue(many);
      const dto = await service.start('u1', 'c1');
      expect(dto.questions).toHaveLength(ASSESSMENT_SAMPLE_SIZE);
    });

    it('nothing assessable: a skip-test is refused (learn the lessons instead)', async () => {
      lessonItemFindMany.mockResolvedValue([]);
      await expect(service.start('u1', 'c1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(markUpsert).not.toHaveBeenCalled();
    });

    it('nothing assessable after the lessons: the exit gate auto-passes instead of blocking', async () => {
      getState.mockResolvedValue(curriculumState({ lessonsDone: true }));
      lessonItemFindMany.mockResolvedValue([
        { lessonId: 'l1', item: { ...grammar, meaning: null } }, // a Tanos shell
      ]);
      const dto = await service.start('u1', 'c1');
      expect(dto).toMatchObject({
        kind: 'EXIT',
        autoPassed: true,
        questions: [],
      });
      const [[created]] = attemptCreate.mock.calls as [
        [{ data: Record<string, unknown> }],
      ];
      expect(created.data).toMatchObject({ status: 'PASSED', itemIds: [] });
      expect(markUpsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('submit', () => {
    const attempt = (over: Record<string, unknown> = {}) => ({
      id: 'att-1',
      userId: 'u1',
      chapterId: 'c1',
      kind: 'SKIP',
      status: 'IN_PROGRESS',
      itemIds: ['k1', 'k2', 'k3', 'g1'],
      createdAt: new Date(),
      correctCount: null,
      results: null,
      ...over,
    });
    const answers = (map: Record<string, string>) => ({
      answers: Object.entries(map).map(([itemId, answer]) => ({
        itemId,
        answer,
      })),
    });
    const allRight = { k1: 'ka1', k2: 'ka2', k3: 'ka3', g1: 'please do' };
    const storedPass = {
      status: 'PASSED',
      correctCount: 4,
      results: {
        items: [
          {
            itemId: 'k1',
            prompt: 'p',
            answer: 'ka1',
            correct: true,
            correctAnswer: 'ka1',
          },
        ],
        total: 4,
        skippedLessonIds: [],
      },
    };

    it('404s for a missing attempt or another learner’s', async () => {
      attemptFindUnique.mockResolvedValueOnce(null);
      await expect(
        service.submit('u1', 'att-1', answers({})),
      ).rejects.toBeInstanceOf(NotFoundException);
      attemptFindUnique.mockResolvedValueOnce(attempt({ userId: 'other' }));
      await expect(
        service.submit('u1', 'att-1', answers({})),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('replays the stored result for an attempt already submitted (idempotent)', async () => {
      attemptFindUnique.mockResolvedValue(attempt(storedPass));
      const res = await service.submit('u1', 'att-1', answers(allRight));
      expect(res).toMatchObject({ passed: true, correct: 4, total: 4 });
      expect(res.results).toHaveLength(1);
      expect(attemptUpdateMany).not.toHaveBeenCalled();
      expect(recordCheckResult).not.toHaveBeenCalled();
    });

    it('replays the winner when a concurrent submit claimed it first — and writes nothing', async () => {
      attemptFindUnique
        .mockResolvedValueOnce(attempt())
        .mockResolvedValueOnce(attempt(storedPass));
      attemptUpdateMany.mockResolvedValue({ count: 0 });
      const res = await service.submit('u1', 'att-1', answers(allRight));
      expect(res).toMatchObject({ passed: true, correct: 4 });
      expect(recordCheckResult).not.toHaveBeenCalled();
      expect(markUpsert).not.toHaveBeenCalled();
    });

    it('410s for an attempt older than the TTL', async () => {
      attemptFindUnique.mockResolvedValue(
        attempt({ createdAt: new Date(Date.now() - ASSESSMENT_TTL_MS - 1000) }),
      );
      await expect(
        service.submit('u1', 'att-1', answers(allRight)),
      ).rejects.toBeInstanceOf(GoneException);
      expect(attemptUpdateMany).not.toHaveBeenCalled();
    });

    it('409s when the chapter was passed meanwhile (stale attempt)', async () => {
      attemptFindUnique.mockResolvedValue(attempt());
      getState.mockResolvedValue(curriculumState({ assessment: false }));
      await expect(
        service.submit('u1', 'att-1', answers(allRight)),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(recordCheckResult).not.toHaveBeenCalled();
    });

    it('pass: marks the chapter, clears a relocation to it, records reviews, seeds untested items', async () => {
      attemptFindUnique.mockResolvedValue(
        attempt({ itemIds: ['k1', 'k2', 'k3'] }),
      );
      itemFindMany.mockResolvedValue([kana(1), kana(2), kana(3)]);
      const res = await service.submit(
        'u1',
        'att-1',
        answers({ k1: 'ka1', k2: 'KA2', k3: 'ka3' }),
      );

      expect(res).toMatchObject({ passed: true, correct: 3, total: 3 });
      expect(res.results[1]).toEqual({
        itemId: 'k2',
        prompt: 'Type the rōmaji for 「か2」',
        answer: 'KA2',
        correct: true,
        correctAnswer: 'ka2',
      });
      const [[claim]] = attemptUpdateMany.mock.calls as [
        [{ where: unknown; data: Record<string, unknown> }],
      ];
      expect(claim.where).toEqual({ id: 'att-1', status: 'IN_PROGRESS' });
      expect(claim.data).toMatchObject({
        status: 'PASSED',
        correctCount: 3,
        results: { total: 3, skippedLessonIds: [] },
      });
      const [[mark]] = markUpsert.mock.calls as [
        [{ where: unknown; update: Record<string, unknown> }],
      ];
      expect(mark.where).toEqual({
        userId_chapterId: { userId: 'u1', chapterId: 'c1' },
      });
      expect(mark.update).toMatchObject({ kind: 'PASSED_ASSESSMENT' });
      expect(userUpdateMany).toHaveBeenCalledWith({
        where: { id: 'u1', currentChapterId: 'c1' },
        data: { currentChapterId: null },
      });
      expect(recordCheckResult).toHaveBeenCalledTimes(3);
      expect(seedInferred).toHaveBeenCalledWith('u1', ['g1'], expect.any(Date));
      expect(skipCreateMany).not.toHaveBeenCalled();
    });

    it('grades meaning answers with the AI grader and skips it for blank answers', async () => {
      attemptFindUnique.mockResolvedValue(attempt());
      const res = await service.submit(
        'u1',
        'att-1',
        answers({ ...allRight, g1: 'please do', k3: '   ' }),
      );
      expect(gradeOpen).toHaveBeenCalledTimes(1);
      expect(gradeOpen).toHaveBeenCalledWith({
        prompt: 'What does 「〜ください」 mean?',
        answer: 'please do',
        exemplar: 'please do',
      });
      expect(res.results.find((r) => r.itemId === 'k3')?.correct).toBe(false);
      expect(res).toMatchObject({ correct: 3, total: 4, passed: false });
    });

    it('a fallback-graded miss (grader outage) is not held against the learner', async () => {
      attemptFindUnique.mockResolvedValue(attempt({ kind: 'EXIT' }));
      gradeOpen.mockResolvedValue(
        aiGrade(false, { gradedBy: 'fallback', rating: 'Again' }),
      );
      const res = await service.submit(
        'u1',
        'att-1',
        answers({ ...allRight, g1: 'please, do it' }),
      );
      expect(res).toMatchObject({ correct: 3, total: 3, passed: true });
      expect(
        (recordCheckResult.mock.calls as [{ itemId: string }][]).map(
          ([a]) => a.itemId,
        ),
      ).not.toContain('g1');
    });

    it('503s and leaves the attempt open when nothing could be graded', async () => {
      attemptFindUnique.mockResolvedValue(attempt({ itemIds: ['g1'] }));
      gradeOpen.mockResolvedValue(
        aiGrade(false, { gradedBy: 'fallback', scored: false }),
      );
      await expect(
        service.submit('u1', 'att-1', answers({ g1: 'please do' })),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(attemptUpdateMany).not.toHaveBeenCalled();
    });

    it('failed skip-test: no penalty for wrong answers; collapses only fully-tested, all-correct lessons', async () => {
      attemptFindUnique.mockResolvedValue(attempt());
      // l1 (k1,k2) all right; l2 (k3,g1) has a miss.
      const res = await service.submit(
        'u1',
        'att-1',
        answers({ k1: 'ka1', k2: 'ka2', k3: 'nope', g1: 'nope' }),
      );
      expect(res).toMatchObject({
        passed: false,
        correct: 2,
        total: 4,
        skippedLessonIds: ['l1'],
      });
      expect(recordCheckResult).toHaveBeenCalledTimes(2);
      for (const [arg] of recordCheckResult.mock.calls as [
        { correct: boolean },
      ][]) {
        expect(arg.correct).toBe(true);
      }
      expect(skipCreateMany).toHaveBeenCalledWith({
        data: [{ userId: 'u1', lessonId: 'l1' }],
        skipDuplicates: true,
      });
      expect(markUpsert).not.toHaveBeenCalled();
    });

    it('a lesson with an untested item never collapses', async () => {
      attemptFindUnique.mockResolvedValue(
        attempt({ itemIds: ['k1', 'k3', 'g1'] }),
      );
      const res = await service.submit(
        'u1',
        'att-1',
        answers({ k1: 'ka1', k3: 'nope', g1: 'nope' }),
      );
      expect(res.passed).toBe(false);
      expect(res.skippedLessonIds).toEqual([]); // l1's k2 wasn't tested
      expect(skipCreateMany).not.toHaveBeenCalled();
    });

    it('failed exit Assessment: wrong answers get Again; no lesson collapsing', async () => {
      attemptFindUnique.mockResolvedValue(attempt({ kind: 'EXIT' }));
      const res = await service.submit(
        'u1',
        'att-1',
        answers({ k1: 'ka1', k2: 'nope', k3: 'nope', g1: 'nope' }),
      );
      expect(res).toMatchObject({ passed: false, kind: 'EXIT' });
      expect(recordCheckResult).toHaveBeenCalledTimes(4);
      expect(
        (recordCheckResult.mock.calls as [{ correct: boolean }][]).filter(
          ([a]) => !a.correct,
        ),
      ).toHaveLength(3);
      expect(skipCreateMany).not.toHaveBeenCalled();
    });

    it('excludes answers the grader could not score from the total and FSRS', async () => {
      attemptFindUnique.mockResolvedValue(attempt({ itemIds: ['k1', 'g1'] }));
      gradeOpen.mockResolvedValue(
        aiGrade(false, { gradedBy: 'fallback', scored: false, exemplar: '' }),
      );
      const res = await service.submit(
        'u1',
        'att-1',
        answers({ k1: 'ka1', g1: 'something' }),
      );
      expect(res).toMatchObject({ correct: 1, total: 1, passed: true });
      expect(recordCheckResult).toHaveBeenCalledTimes(1);
    });

    it('missing answers count as wrong', async () => {
      attemptFindUnique.mockResolvedValue(attempt({ kind: 'EXIT' }));
      const res = await service.submit('u1', 'att-1', answers({ k1: 'ka1' }));
      expect(res).toMatchObject({ correct: 1, total: 4, passed: false });
    });

    it('a failed FSRS write does not fail the submit (outcome already recorded)', async () => {
      attemptFindUnique.mockResolvedValue(attempt());
      recordCheckResult.mockRejectedValue(new Error('db blip'));
      const res = await service.submit('u1', 'att-1', answers(allRight));
      expect(res.passed).toBe(true);
      expect(markUpsert).toHaveBeenCalledTimes(1);
    });
  });
});
