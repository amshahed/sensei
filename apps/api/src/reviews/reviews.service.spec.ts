import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReviewsService, REVIEW_SESSION_CAP } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from '../mastery/mastery.service';
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

  beforeEach(async () => {
    itemFindUnique = jest.fn();
    getDue = jest.fn();
    recordCheckResult = jest.fn().mockResolvedValue({ mastery: 0.25 });

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: PrismaService,
          useValue: { item: { findUnique: itemFindUnique } },
        },
        { provide: MasteryService, useValue: { getDue, recordCheckResult } },
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

    it('throws NotFound for an unknown item', async () => {
      itemFindUnique.mockResolvedValue(null);

      await expect(
        service.grade('dev-user', 'nope', 'a'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(recordCheckResult).not.toHaveBeenCalled();
    });
  });
});
