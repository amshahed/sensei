import { Test } from '@nestjs/testing';
import { GradingService } from './grading.service';
import { LLM_CLIENT, type LlmClient } from '../llm/llm-client';

function makeService(llm: Partial<LlmClient>): Promise<GradingService> {
  return Test.createTestingModule({
    providers: [GradingService, { provide: LLM_CLIENT, useValue: llm }],
  })
    .compile()
    .then((m) => m.get(GradingService));
}

describe('GradingService', () => {
  describe('with the model available', () => {
    it('returns the model rating + feedback and marks it scored', async () => {
      const parseJson = jest.fn().mockResolvedValue({
        rating: 'Hard',
        feedback: 'Close — wrong particle.',
      });
      const service = await makeService({ enabled: true, parseJson });

      const result = await service.gradeOpen({
        prompt: 'Say good morning politely.',
        answer: 'ohayou',
        exemplar: 'おはようございます',
      });

      expect(result).toEqual({
        rating: 'Hard',
        correct: true, // anything but "Again"
        feedback: 'Close — wrong particle.',
        exemplar: 'おはようございます',
        gradedBy: 'ai',
        scored: true,
      });
      expect(parseJson).toHaveBeenCalledTimes(1);
    });

    it('falls back when the model returns an off-enum rating', async () => {
      const parseJson = jest
        .fn()
        .mockResolvedValue({ rating: 'great', feedback: 'hmm' });
      const service = await makeService({ enabled: true, parseJson });

      const result = await service.gradeOpen({
        prompt: 'p',
        answer: 'おはようございます',
        exemplar: 'おはようございます',
      });

      // Did not trust the bad rating; fell back to exemplar exact-match.
      expect(result.gradedBy).toBe('fallback');
      expect(result.rating).toBe('Good');
      expect(result.correct).toBe(true);
    });

    it('falls back when the model call throws', async () => {
      const parseJson = jest.fn().mockRejectedValue(new Error('429'));
      const service = await makeService({ enabled: true, parseJson });

      const result = await service.gradeOpen({
        prompt: 'p',
        answer: 'おはようございます',
        exemplar: 'おはようございます',
      });

      // Fell back to exact-match against the exemplar.
      expect(result.gradedBy).toBe('fallback');
      expect(result.correct).toBe(true);
      expect(result.scored).toBe(true);
    });
  });

  describe('with the model disabled (no API key)', () => {
    const disabled: Partial<LlmClient> = {
      enabled: false,
      parseJson: jest.fn(),
    };

    it('exact-matches against an exemplar', async () => {
      const service = await makeService(disabled);

      const right = await service.gradeOpen({
        prompt: 'p',
        answer: '  おはようございます ',
        exemplar: 'おはようございます',
      });
      expect(right.correct).toBe(true);
      expect(right.rating).toBe('Good');
      expect(right.scored).toBe(true);

      const wrong = await service.gradeOpen({
        prompt: 'p',
        answer: 'ohayou',
        exemplar: 'おはようございます',
      });
      expect(wrong.correct).toBe(false);
      expect(wrong.rating).toBe('Again');
    });

    it('accepts but does NOT score an answer when there is no exemplar', async () => {
      const service = await makeService(disabled);

      const result = await service.gradeOpen({
        prompt: 'Open reflection question.',
        answer: 'my honest attempt',
      });

      expect(result.correct).toBe(true);
      expect(result.scored).toBe(false); // can't really grade → keep out of FSRS
      expect(result.gradedBy).toBe('fallback');
    });

    it('never calls the model when disabled', async () => {
      const service = await makeService(disabled);
      await service.gradeOpen({ prompt: 'p', answer: 'x', exemplar: 'y' });
      expect(disabled.parseJson).not.toHaveBeenCalled();
    });
  });

  it('scores a blank answer as Again without calling the model', async () => {
    const parseJson = jest.fn();
    const service = await makeService({ enabled: true, parseJson });

    const result = await service.gradeOpen({ prompt: 'p', answer: '   ' });

    expect(result.rating).toBe('Again');
    expect(result.correct).toBe(false);
    expect(result.scored).toBe(true);
    expect(parseJson).not.toHaveBeenCalled();
  });
});
