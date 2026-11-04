import { StreakService } from '../streak/streak.service';
import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReviewsService, REVIEW_SESSION_CAP } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from '../mastery/mastery.service';
import { GradingService } from '../grading/grading.service';
import { RecallGraderService } from '../recall/recall-grader.service';
import { WritingEvalService } from '../writing-eval/writing-eval.service';
import type { DueReviewItemDto } from '@sensei/types';

function dueItem(itemId: string): DueReviewItemDto {
  return {
    itemId,
    type: 'KANA',
    display: 'あ',
    mastery: 0.1,
    retrievability: 0.5,
    due: '2026-06-13T00:00:00.000Z',
    weakestModality: 'recall',
    prompt: 'Type the rōmaji for 「あ」',
  };
}

describe('ReviewsService', () => {
  const streakRecord = jest.fn().mockResolvedValue(undefined);
  let service: ReviewsService;
  let itemFindUnique: jest.Mock;
  let getDue: jest.Mock;
  let recordCheckResult: jest.Mock;
  let gradeOpen: jest.Mock;
  let stateFindUnique: jest.Mock;
  let stateFindFirst: jest.Mock;

  beforeEach(async () => {
    itemFindUnique = jest.fn();
    getDue = jest.fn();
    recordCheckResult = jest.fn().mockResolvedValue({ mastery: 0.25 });
    gradeOpen = jest.fn();
    stateFindUnique = jest.fn().mockResolvedValue({ mastery: 0.4 });
    // The item was due when answered (the normal review case).
    stateFindFirst = jest.fn().mockResolvedValue({ itemId: 'x' });

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: StreakService, useValue: { record: streakRecord } },
        {
          provide: PrismaService,
          useValue: {
            item: { findUnique: itemFindUnique },
            itemMasteryState: {
              findUnique: stateFindUnique,
              findFirst: stateFindFirst,
            },
          },
        },
        {
          provide: MasteryService,
          useValue: {
            getDue,
            recordCheckResult,
            currentMastery: jest.fn().mockResolvedValue(0.4),
          },
        },
        RecallGraderService, // real shared grader over mocked AI + normaliser
        { provide: GradingService, useValue: { gradeOpen } },
        {
          provide: WritingEvalService,
          useValue: { exactMatch: (a: string, b: string) => a === b },
        },
      ],
    }).compile();
    service = moduleRef.get(ReviewsService);
  });

  describe('due', () => {
    it('caps the queue at the session limit', async () => {
      getDue.mockResolvedValue(
        Array.from({ length: 30 }, (_, i) => dueItem(`ja:kana:${i}`)),
      );

      const due = await service.due('dev-user');

      expect(due).toHaveLength(REVIEW_SESSION_CAP);
    });

    it('passes through a short queue unchanged', async () => {
      getDue.mockResolvedValue([dueItem('ja:kana:a')]);
      expect(await service.due('dev-user')).toHaveLength(1);
    });
  });

  describe('grade', () => {
    const kana = {
      id: 'ja:kana:a',
      type: 'KANA',
      display: 'あ',
      reading: 'あ',
      meaning: null,
      data: { romaji: 'a' },
    };

    it('grades a correct rōmaji answer and writes back via TYPED', async () => {
      itemFindUnique.mockResolvedValue(kana);

      const result = await service.grade('dev-user', 'ja:kana:a', 'A');

      expect(result).toEqual({
        itemId: 'ja:kana:a',
        correct: true,
        correctAnswer: 'a',
        mastery: 0.25,
        scored: true,
      });
      expect(recordCheckResult).toHaveBeenCalledWith({
        userId: 'dev-user',
        itemId: 'ja:kana:a',
        format: 'TYPED',
        correct: true,
        rating: undefined,
      });
    });

    it('a scored answer to a due item is credited to the streak as a review (K.3.f)', async () => {
      itemFindUnique.mockResolvedValue(kana);
      streakRecord.mockClear();
      await service.grade('dev-user', 'ja:kana:a', 'i');
      expect(streakRecord).toHaveBeenCalledWith('dev-user', {
        kind: 'answers',
        count: 1,
        review: true,
      });
      // Due-ness is read before the FSRS write moves it...
      expect(stateFindFirst).toHaveBeenCalledWith({
        where: {
          userId: 'dev-user',
          itemId: 'ja:kana:a',
          due: { lte: expect.any(Date) as Date },
        },
        select: { itemId: true },
      });
      expect(stateFindFirst.mock.invocationCallOrder[0]).toBeLessThan(
        recordCheckResult.mock.invocationCallOrder[0],
      );
      // ...and the credit lands after it, so "reviews cleared" sees it as done.
      expect(recordCheckResult.mock.invocationCallOrder[0]).toBeLessThan(
        streakRecord.mock.invocationCallOrder[0],
      );
    });

    it('a not-due item (or a repeat of one just answered) is effort, not a review', async () => {
      itemFindUnique.mockResolvedValue(kana);
      stateFindFirst.mockResolvedValue(null);
      streakRecord.mockClear();
      await service.grade('dev-user', 'ja:kana:a', 'a');
      expect(recordCheckResult).toHaveBeenCalled();
      expect(streakRecord).toHaveBeenCalledWith('dev-user', {
        kind: 'answers',
        count: 1,
        review: false,
      });
    });

    it('grades a wrong answer as incorrect but still records it', async () => {
      itemFindUnique.mockResolvedValue(kana);

      const result = await service.grade('dev-user', 'ja:kana:a', 'i');

      expect(result.correct).toBe(false);
      expect(recordCheckResult).toHaveBeenCalledWith(
        expect.objectContaining({ correct: false }),
      );
    });

    it('kanji: any on/kun reading counts (KANJIDIC2 markers resolved)', async () => {
      itemFindUnique.mockResolvedValue({
        id: 'ja:kanji:一',
        type: 'KANJI',
        display: '一',
        reading: 'ひと-',
        meaning: 'one',
        data: { on_readings: ['イチ'], kun_readings: ['ひと-', 'ひと.つ'] },
      });
      const result = await service.grade('dev-user', 'ja:kanji:一', 'ひとつ');
      expect(result).toMatchObject({
        correct: true,
        correctAnswer: 'イチ・ひと・ひと(つ)',
      });
    });

    it('meaning answers are AI-graded and the rating flows into FSRS', async () => {
      itemFindUnique.mockResolvedValue({
        id: 'ja:vocab:すし',
        type: 'VOCAB',
        display: 'すし',
        reading: 'すし',
        meaning: 'sushi',
        data: {},
      });
      gradeOpen.mockResolvedValue({
        rating: 'Easy',
        correct: true,
        gradedBy: 'ai',
        scored: true,
        feedback: 'Exactly.',
      });
      const result = await service.grade('dev-user', 'ja:vocab:すし', 'sushi');
      expect(result).toMatchObject({ correct: true, feedback: 'Exactly.' });
      expect(recordCheckResult).toHaveBeenCalledWith(
        expect.objectContaining({ correct: true, rating: 4 }),
      );
    });

    it('grader down and fallback says wrong: shows the answer, records nothing, learner moves on', async () => {
      itemFindUnique.mockResolvedValue({
        id: 'ja:vocab:すし',
        type: 'VOCAB',
        display: 'すし',
        reading: 'すし',
        meaning: 'sushi',
        data: {},
      });
      gradeOpen.mockResolvedValue({
        rating: 'Again',
        correct: false,
        gradedBy: 'fallback',
        scored: true,
      });
      const result = await service.grade(
        'dev-user',
        'ja:vocab:すし',
        'raw fish rice',
      );
      expect(result).toEqual({
        itemId: 'ja:vocab:すし',
        correct: false,
        correctAnswer: 'sushi',
        scored: false,
        mastery: 0.4, // unchanged, read back
      });
      expect(recordCheckResult).not.toHaveBeenCalled();
      // Still effort — but the item stays due, so it can't clear a review.
      expect(streakRecord).toHaveBeenLastCalledWith('dev-user', {
        kind: 'answers',
        count: 1,
        review: false,
      });
    });

    it('400s for an item with nothing to check against (e.g. a grammar shell)', async () => {
      itemFindUnique.mockResolvedValue({
        id: 'ja:grammar:です',
        type: 'GRAMMAR',
        display: 'です',
        reading: null,
        meaning: null,
        data: {},
      });
      await expect(
        service.grade('dev-user', 'ja:grammar:です', 'is'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(recordCheckResult).not.toHaveBeenCalled();
    });

    it('throws NotFound for an unknown item', async () => {
      itemFindUnique.mockResolvedValue(null);

      await expect(
        service.grade('dev-user', 'nope', 'a'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(recordCheckResult).not.toHaveBeenCalled();
    });
  });
});
