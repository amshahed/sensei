import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ChecksService } from './checks.service';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from '../mastery/mastery.service';

const check = {
  id: 'chk-1',
  lessonId: 'lesson-1',
  position: 0,
  prompt: 'Which kana is read “a”?',
  format: 'MULTIPLE_CHOICE',
  targetItemId: 'ja:kana:a',
  data: { choices: ['あ', 'い', 'う'], answer: 'あ' },
};

describe('ChecksService', () => {
  let service: ChecksService;
  let findUnique: jest.Mock;
  let recordCheckResult: jest.Mock;

  beforeEach(async () => {
    findUnique = jest.fn();
    recordCheckResult = jest.fn().mockResolvedValue({});
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChecksService,
        { provide: PrismaService, useValue: { check: { findUnique } } },
        { provide: MasteryService, useValue: { recordCheckResult } },
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
});
