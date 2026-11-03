import {
  BadRequestException,
  ConflictException,
  NotFoundException,
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
      Promise.resolve({
        rating: answer === 'please do' ? 'Good' : 'Again',
        correct: answer === 'please do',
        feedback: '',
        exemplar: 'please do',
        gradedBy: 'ai',
        scored: true,
      }),
    );

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
        {
          provide: PrismaService,
          useValue: {
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
          },
        },
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

    it('400s when the chapter has nothing assessable', async () => {
      lessonItemFindMany.mockResolvedValue([]);
      await expect(service.start('u1', 'c1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('stores the sampled items server-side and never sends answers', async () => {
      const dto = await service.start('u1', 'c1');
      expect(dto).toMatchObject({
        attemptId: 'att-1',
        chapterId: 'c1',
        chapterTitle: 'Chapter 1',
        kind: 'SKIP', // lessons not done yet
        passThreshold: 0.8,
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
  });

  describe('submit', () => {
    const attempt = (over: Record<string, unknown> = {}) => ({
      id: 'att-1',
      userId: 'u1',
      chapterId: 'c1',
      kind: 'SKIP',
      status: 'IN_PROGRESS',
      itemIds: ['k1', 'k2', 'k3', 'g1'],
      ...over,
    });
    const answers = (map: Record<string, string>) => ({
      answers: Object.entries(map).map(([itemId, answer]) => ({
        itemId,
        answer,
      })),
    });
    const allRight = { k1: 'ka1', k2: 'ka2', k3: 'ka3', g1: 'please do' };

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

    it('409s for an attempt already submitted', async () => {
      attemptFindUnique.mockResolvedValue(attempt({ status: 'PASSED' }));
      await expect(
        service.submit('u1', 'att-1', answers(allRight)),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('409s and writes nothing when a concurrent submit claimed it first', async () => {
      attemptFindUnique.mockResolvedValue(attempt());
      attemptUpdateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.submit('u1', 'att-1', answers(allRight)),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(recordCheckResult).not.toHaveBeenCalled();
      expect(markUpsert).not.toHaveBeenCalled();
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
      expect(claim.data).toMatchObject({ status: 'PASSED', correctCount: 3 });
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
      attemptFindUnique.mockResolvedValue(attempt({ itemIds: ['k1', 'k3'] }));
      const res = await service.submit(
        'u1',
        'att-1',
        answers({ k1: 'ka1', k3: 'ka3' }),
      );
      expect(res.passed).toBe(true); // 2/2 → passes instead
      attemptFindUnique.mockResolvedValue(
        attempt({ itemIds: ['k1', 'k3', 'g1'] }),
      );
      attemptUpdateMany.mockResolvedValue({ count: 1 });
      const fail = await service.submit(
        'u1',
        'att-1',
        answers({ k1: 'ka1', k3: 'nope', g1: 'nope' }),
      );
      expect(fail.skippedLessonIds).toEqual([]); // l1's k2 wasn't tested
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
      gradeOpen.mockResolvedValue({
        rating: 'Again',
        correct: false,
        feedback: '',
        exemplar: '',
        gradedBy: 'fallback',
        scored: false,
      });
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
  });
});
