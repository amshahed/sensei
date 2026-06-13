import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Rating } from 'ts-fsrs';
import { ChecksService } from './checks.service';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from '../mastery/mastery.service';
import { GradingService } from '../grading/grading.service';

const check = {
  id: 'chk-1',
  lessonId: 'lesson-1',
  position: 0,
  prompt: 'Which kana is read “a”?',
  format: 'MULTIPLE_CHOICE',
  targetItemId: 'ja:kana:a',
  data: { choices: ['あ', 'い', 'う'], answer: 'あ' },
};

const openCheck = {
  id: 'chk-open',
  lessonId: 'lesson-1',
  position: 1,
  prompt: 'Say "good morning" politely in Japanese.',
  format: 'TYPED',
  targetItemId: 'ja:phrase:ohayou',
  data: { exemplar: 'おはようございます' },
};

describe('ChecksService', () => {
  let service: ChecksService;
  let findUnique: jest.Mock;
  let recordCheckResult: jest.Mock;
  let gradeOpen: jest.Mock;

  beforeEach(async () => {
    findUnique = jest.fn();
    recordCheckResult = jest.fn().mockResolvedValue({});
    gradeOpen = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChecksService,
        { provide: PrismaService, useValue: { check: { findUnique } } },
        { provide: MasteryService, useValue: { recordCheckResult } },
        { provide: GradingService, useValue: { gradeOpen } },
      ],
    }).compile();
    service = moduleRef.get(ChecksService);
  });

  it('grades a correct answer and reveals the answer', async () => {
    findUnique.mockResolvedValue(check);

    const result = await service.grade('chk-1', 'あ', 'dev-user');

    expect(result).toEqual({
      checkId: 'chk-1',
      correct: true,
      correctAnswer: 'あ',
    });
  });

  it('grades a wrong answer as incorrect', async () => {
    findUnique.mockResolvedValue(check);

    const result = await service.grade('chk-1', 'い', 'dev-user');

    expect(result.correct).toBe(false);
    expect(result.correctAnswer).toBe('あ');
  });

  it('normalises whitespace and case before comparing', async () => {
    findUnique.mockResolvedValue({
      ...check,
      data: { answer: 'Konnichiwa' },
    });

    const result = await service.grade('chk-1', '  konnichiwa  ', 'dev-user');

    expect(result.correct).toBe(true);
  });

  it('writes the result back to mastery for the acting user', async () => {
    findUnique.mockResolvedValue(check);

    await service.grade('chk-1', 'あ', 'dev-user');

    expect(recordCheckResult).toHaveBeenCalledWith({
      userId: 'dev-user',
      itemId: 'ja:kana:a',
      format: 'MULTIPLE_CHOICE',
      correct: true,
    });
  });

  it('still returns the grade if mastery write-back fails', async () => {
    findUnique.mockResolvedValue(check);
    recordCheckResult.mockRejectedValue(new Error('db down'));

    const result = await service.grade('chk-1', 'あ', 'dev-user');

    expect(result.correct).toBe(true);
  });

  it('throws NotFound for an unknown check', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      service.grade('nope', 'あ', 'dev-user'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('open / free-response checks (AI grading)', () => {
    it('routes a check with no fixed answer to the grader and writes the rating back', async () => {
      findUnique.mockResolvedValue(openCheck);
      gradeOpen.mockResolvedValue({
        rating: 'Good',
        correct: true,
        feedback: 'Spot on.',
        exemplar: 'おはようございます',
        gradedBy: 'ai',
        scored: true,
      });

      const result = await service.grade(
        'chk-open',
        'ohayou gozaimasu',
        'dev-user',
      );

      expect(gradeOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: openCheck.prompt,
          answer: 'ohayou gozaimasu',
          exemplar: 'おはようございます',
        }),
      );
      expect(result).toEqual({
        checkId: 'chk-open',
        correct: true,
        correctAnswer: 'おはようございます',
        feedback: 'Spot on.',
      });
      expect(recordCheckResult).toHaveBeenCalledWith({
        userId: 'dev-user',
        itemId: 'ja:phrase:ohayou',
        format: 'TYPED',
        correct: true,
        rating: Rating.Good,
      });
    });

    it('maps an AI "Again" to a wrong result and an FSRS Again', async () => {
      findUnique.mockResolvedValue(openCheck);
      gradeOpen.mockResolvedValue({
        rating: 'Again',
        correct: false,
        feedback: 'Not quite.',
        exemplar: 'おはようございます',
        gradedBy: 'ai',
        scored: true,
      });

      const result = await service.grade('chk-open', 'inu', 'dev-user');

      expect(result.correct).toBe(false);
      expect(recordCheckResult).toHaveBeenCalledWith(
        expect.objectContaining({ rating: Rating.Again, correct: false }),
      );
    });

    it('does NOT write mastery when the grader could not actually score it', async () => {
      findUnique.mockResolvedValue(openCheck);
      gradeOpen.mockResolvedValue({
        rating: 'Good',
        correct: true,
        feedback: 'Answer recorded (automatic grading was unavailable).',
        exemplar: '',
        gradedBy: 'fallback',
        scored: false,
      });

      const result = await service.grade('chk-open', 'something', 'dev-user');

      // Learner still gets a response, but FSRS is left untouched.
      expect(result.correct).toBe(true);
      expect(recordCheckResult).not.toHaveBeenCalled();
    });
  });
});
