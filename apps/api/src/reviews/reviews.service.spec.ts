import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
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
    reading: 'あ',
    meaning: null,
    mastery: 0.1,
    retrievability: 0.5,
    due: '2026-06-13T00:00:00.000Z',
    weakestModality: 'recall',
    prompt: 'Type the rōmaji for 「あ」',
  };
}

describe('ReviewsService', () => {
  let service: ReviewsService;
  let itemFindUnique: jest.Mock;
  let getDue: jest.Mock;
  let recordCheckResult: jest.Mock;
  let gradeOpen: jest.Mock;

  beforeEach(async () => {
    itemFindUnique = jest.fn();
    getDue = jest.fn();
    recordCheckResult = jest.fn().mockResolvedValue({ mastery: 0.25 });
    gradeOpen = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: PrismaService,
          useValue: { item: { findUnique: itemFindUnique } },
        },
        { provide: MasteryService, useValue: { getDue, recordCheckResult } },
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
      });
      expect(recordCheckResult).toHaveBeenCalledWith({
        userId: 'dev-user',
        itemId: 'ja:kana:a',
        format: 'TYPED',
        correct: true,
        rating: undefined,
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
      });
      const result = await service.grade('dev-user', 'ja:vocab:すし', 'sushi');
      expect(result.correct).toBe(true);
      expect(recordCheckResult).toHaveBeenCalledWith(
        expect.objectContaining({ correct: true, rating: 4 }),
      );
    });

    it('503s without recording when the grader is down and its fallback says wrong', async () => {
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
      await expect(
        service.grade('dev-user', 'ja:vocab:すし', 'raw fish rice'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(recordCheckResult).not.toHaveBeenCalled();
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
