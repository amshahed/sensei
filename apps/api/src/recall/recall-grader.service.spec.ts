import { Test } from '@nestjs/testing';
import { Rating } from 'ts-fsrs';
import { GradingService } from '../grading/grading.service';
import { WritingEvalService } from '../writing-eval/writing-eval.service';
import { RecallGraderService } from './recall-grader.service';
import type { RecallQuestion } from './recall-question';

const q = (over: Partial<RecallQuestion>): RecallQuestion => ({
  prompt: 'p',
  expected: 'x',
  accepted: ['x'],
  check: 'romaji',
  ...over,
});

describe('RecallGraderService', () => {
  let grader: RecallGraderService;
  let gradeOpen: jest.Mock;
  let normalisedMatch: jest.Mock;

  beforeEach(async () => {
    gradeOpen = jest.fn();
    normalisedMatch = jest.fn((a: string, b: string) => a === b);
    const moduleRef = await Test.createTestingModule({
      providers: [
        RecallGraderService,
        { provide: GradingService, useValue: { gradeOpen } },
        {
          provide: WritingEvalService,
          useValue: { exactMatch: normalisedMatch },
        },
      ],
    }).compile();
    grader = moduleRef.get(RecallGraderService);
  });

  it('a blank answer is a scored miss — no grader call', async () => {
    await expect(grader.grade(q({ check: 'meaning' }), '  ')).resolves.toEqual({
      correct: false,
      scored: true,
    });
    expect(gradeOpen).not.toHaveBeenCalled();
  });

  it('rōmaji: plain (case-insensitive) exact match, not Japanese normalisation', async () => {
    await expect(grader.grade(q({ accepted: ['ka'] }), 'KA')).resolves.toEqual({
      correct: true,
      scored: true,
    });
    expect(normalisedMatch).not.toHaveBeenCalled();
  });

  it('reading: any accepted reading, via Japanese normalisation', async () => {
    const res = await grader.grade(
      q({ check: 'reading', accepted: ['イチ', 'ひと'] }),
      'ひと',
    );
    expect(res).toEqual({ correct: true, scored: true });
    expect(normalisedMatch).toHaveBeenCalledWith('ひと', 'イチ');
  });

  it('meaning: AI rating and feedback flow through', async () => {
    gradeOpen.mockResolvedValue({
      rating: 'Easy',
      correct: true,
      gradedBy: 'ai',
      scored: true,
      feedback: 'Spot on.',
    });
    await expect(
      grader.grade(
        q({ check: 'meaning', prompt: 'What?', expected: 'cat' }),
        'a cat',
      ),
    ).resolves.toEqual({
      correct: true,
      scored: true,
      rating: Rating.Easy,
      feedback: 'Spot on.',
    });
    expect(gradeOpen).toHaveBeenCalledWith({
      prompt: 'What?',
      answer: 'a cat',
      exemplar: 'cat',
    });
  });

  it('meaning: a fallback-graded miss (AI outage) is unscored', async () => {
    gradeOpen.mockResolvedValue({
      rating: 'Again',
      correct: false,
      gradedBy: 'fallback',
      scored: true,
    });
    const res = await grader.grade(q({ check: 'meaning' }), 'kitty');
    expect(res).toMatchObject({ correct: false, scored: false });
  });

  it('meaning: a fallback-graded match still counts', async () => {
    gradeOpen.mockResolvedValue({
      rating: 'Good',
      correct: true,
      gradedBy: 'fallback',
      scored: true,
    });
    await expect(
      grader.grade(q({ check: 'meaning' }), 'x'),
    ).resolves.toMatchObject({
      correct: true,
      scored: true,
    });
  });
});
