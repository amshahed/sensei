import { Test } from '@nestjs/testing';
import { Logger, NotFoundException } from '@nestjs/common';
import { Rating } from 'ts-fsrs';
import { ChecksService } from './checks.service';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from '../mastery/mastery.service';
import { GradingService } from '../grading/grading.service';
import { WritingEvalService } from '../writing-eval/writing-eval.service';
import { LlmCallError, type LlmClient } from '../llm/llm-client';
import { applyRating, emptyCard } from '../mastery/fsrs';
import {
  toLessonDetailDto,
  type LessonWithRelations,
} from '../lessons/lesson.mapper';
import { reversing } from '../testing/random';

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
  let seedInferred: jest.Mock;
  let userUpsert: jest.Mock;
  let answerForms: jest.Mock;

  beforeEach(async () => {
    findUnique = jest.fn();
    answerForms = jest.fn().mockReturnValue(null);
    recordCheckResult = jest.fn().mockResolvedValue({});
    seedInferred = jest.fn().mockResolvedValue(1);
    userUpsert = jest.fn().mockResolvedValue({});
    gradeOpen = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChecksService,
        {
          provide: PrismaService,
          useValue: { check: { findUnique }, user: { upsert: userUpsert } },
        },
        {
          provide: MasteryService,
          useValue: { recordCheckResult, seedInferred },
        },
        { provide: GradingService, useValue: { gradeOpen } },
        {
          provide: WritingEvalService,
          useValue: {
            // Simple normalise-and-compare stub; Japanese-specific normalisation
            // (wanakana + kuromoji) is tested in writing-eval.service.spec.ts.
            exactMatch: (a: string, b: string) =>
              a.trim().toLowerCase() === b.trim().toLowerCase(),
            answerForms,
          },
        },
      ],
    }).compile();
    service = moduleRef.get(ChecksService);
  });

  describe('rōmaji spelling of は and へ on real grading (test.md N1, N5)', () => {
    /** A closed typed check, graded by the real WritingEvalService. */
    const typed = (targetItemId: string, answer: string, typedIn: string) => {
      const row = { ...check, format: 'TYPED', targetItemId, data: { answer } };
      const prisma = {
        check: { findUnique: () => Promise.resolve(row) },
      };
      return new ChecksService(
        prisma as never,
        { recordCheckResult } as never,
        {} as never,
        new WritingEvalService(),
      ).grade('chk-1', typedIn, 'dev-user');
    };

    it.each([
      ['ja:kana:ha', 'は', 'wa'],
      ['ja:kana:ha', 'ha', 'wa'],
      ['ja:kana:he', 'へ', 'e'],
      ['ja:kana:kata-ha', 'ハ', 'wa'],
      ['ja:kana:ha', 'は', 'wa.'],
      ['ja:kana:ha', 'は。', 'wa'],
      ['ja:kana:ha', 'はな', 'wana'],
      ['ja:kana:wo', 'を', 'o'],
    ])('marks a %s check (%s) wrong for %s', async (id, answer, typedIn) => {
      expect((await typed(id, answer, typedIn)).correct).toBe(false);
    });

    it.each([
      ['ja:kana:ha', 'は', 'ha'],
      ['ja:kana:ha', 'は', 'は'],
      ['ja:kana:kata-ha', 'ハ', 'ha'],
      ['ja:kana:he', 'へ', 'he'],
      ['ja:kana:ha', 'は', 'ha.'],
      ['ja:kana:ha', 'は', 'ha!'],
      ['ja:kana:ha', 'こんにちは', 'konnichiwa'],
      ['ja:kana:ha', 'こんにちは！', 'konnichiwa'],
      ['ja:kana:ha', 'はな。', 'hana'],
      ['ja:grammar:は', 'は', 'wa'],
      ['ja:grammar:は', 'は', 'ha'],
      ['ja:vocab:konnichiwa', 'こんにちは', 'konnichiwa'],
    ])('marks a %s check (%s) right for %s', async (id, answer, typedIn) => {
      expect((await typed(id, answer, typedIn)).correct).toBe(true);
    });
  });

  it('grades a correct answer and reveals the answer', async () => {
    findUnique.mockResolvedValue(check);

    const result = await service.grade('chk-1', 'あ', 'dev-user');

    expect(result).toEqual({
      checkId: 'chk-1',
      correct: true,
      correctAnswer: 'あ',
      scored: true,
    });
  });

  it('grades the shuffled options by text, wherever the answer sits (B.2.e, P8)', async () => {
    const stored = {
      ...check,
      data: {
        choices: ['ticket', 'stamp', 'school', 'magazine'],
        answer: 'ticket',
      },
    };
    findUnique.mockResolvedValue(stored);
    const lesson = {
      id: 'lesson-1',
      chapter: { module: {} },
      items: [],
      checks: [stored],
    } as unknown as LessonWithRelations;
    const { choices } = toLessonDetailDto(lesson, reversing(4)).checks[0];
    expect(choices).toEqual(['magazine', 'school', 'stamp', 'ticket']);

    const verdicts: boolean[] = [];
    for (const choice of choices!) {
      verdicts.push((await service.grade('chk-1', choice, 'dev-user')).correct);
    }
    expect(verdicts).toEqual([false, false, false, true]);
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

  describe('"I guessed" flag (K.1)', () => {
    it('downgrades a correct guessed multiple-choice answer to Hard', async () => {
      findUnique.mockResolvedValue(check);

      await service.grade('chk-1', 'あ', 'dev-user', { guessed: true });

      expect(recordCheckResult).toHaveBeenCalledWith(
        expect.objectContaining({ correct: true, rating: Rating.Hard }),
      );
    });

    it('leaves an un-guessed correct answer at the default rating', async () => {
      findUnique.mockResolvedValue(check);

      await service.grade('chk-1', 'あ', 'dev-user', { guessed: false });

      // No explicit rating → mastery derives Good from `correct`.
      expect(recordCheckResult).toHaveBeenCalledWith(
        expect.objectContaining({ correct: true, rating: undefined }),
      );
    });

    it('never inflates: a wrong guessed answer is unaffected', async () => {
      findUnique.mockResolvedValue(check);

      await service.grade('chk-1', 'い', 'dev-user', { guessed: true });

      expect(recordCheckResult).toHaveBeenCalledWith(
        expect.objectContaining({ correct: false, rating: undefined }),
      );
    });

    it('ignores the flag on non-multiple-choice (closed TYPED) checks', async () => {
      findUnique.mockResolvedValue({
        ...check,
        format: 'TYPED',
        data: { answer: 'あ' },
      });

      await service.grade('chk-1', 'あ', 'dev-user', { guessed: true });

      // TYPED is not a guess-prone format — no downgrade.
      expect(recordCheckResult).toHaveBeenCalledWith(
        expect.objectContaining({ correct: true, rating: undefined }),
      );
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

  describe('the explanation (B.2.a, P1, P6)', () => {
    const explanation = 'あ is a, as in "father".';
    const typedCheck = {
      ...check,
      format: 'TYPED',
      data: { answer: 'あ', explanation },
    };

    it.each([
      [
        'MULTIPLE_CHOICE',
        'right',
        { ...check, data: { ...check.data, explanation } },
        'あ',
      ],
      [
        'MULTIPLE_CHOICE',
        'wrong',
        { ...check, data: { ...check.data, explanation } },
        'い',
      ],
      ['TYPED', 'right', typedCheck, 'あ'],
      ['TYPED', 'wrong', typedCheck, 'い'],
    ])(
      'comes with a %s answer graded %s',
      async (_format, _how, row, answer) => {
        findUnique.mockResolvedValue(row);

        const result = await service.grade('chk-1', answer, 'dev-user');

        expect(result.explanation).toBe(explanation);
      },
    );

    it('comes with an open check graded by the model', async () => {
      findUnique.mockResolvedValue({
        ...openCheck,
        data: { ...openCheck.data, explanation },
      });
      gradeOpen.mockResolvedValue({
        rating: 'Again',
        correct: false,
        feedback: 'Not a greeting.',
        exemplar: 'おはようございます',
        gradedBy: 'ai',
        scored: true,
      });

      const result = await service.grade('chk-open', 'inu', 'dev-user');

      expect(result.explanation).toBe(explanation);
    });

    it('is sent as written', async () => {
      findUnique.mockResolvedValue({
        ...check,
        data: { ...check.data, explanation: ' Two lines.\nAs written. ' },
      });

      const result = await service.grade('chk-1', 'あ', 'dev-user');

      expect(result.explanation).toBe(' Two lines.\nAs written. ');
    });

    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['blank', '   '],
      ['not text', 42],
    ])('has no key at all when it is %s', async (_how, value) => {
      findUnique.mockResolvedValue({
        ...check,
        data: { ...check.data, explanation: value },
      });

      const result = await service.grade('chk-1', 'い', 'dev-user');

      expect(result).not.toHaveProperty('explanation');
      expect(result).toEqual({
        checkId: 'chk-1',
        correct: false,
        correctAnswer: 'あ',
        scored: true,
      });
    });
  });

  describe('the answer in kana and rōmaji (B.2.b, P3)', () => {
    const forms = { kana: 'きっぷ', romaji: 'kippu' };
    const typedCheck = {
      ...check,
      format: 'TYPED',
      targetItemId: 'ja:vocab:切符',
      prompt: 'Read this word and type how it sounds: きっぷ',
      data: { answer: 'きっぷ' },
    };

    it('comes with a closed typed check, built from its answer and prompt', async () => {
      findUnique.mockResolvedValue(typedCheck);
      answerForms.mockReturnValue(forms);

      const result = await service.grade('chk-1', 'kipu', 'dev-user');

      expect(answerForms).toHaveBeenCalledWith('きっぷ', {
        kanaTarget: false,
        prompt: typedCheck.prompt,
      });
      expect(result).toMatchObject({ correct: false, answerForms: forms });
    });

    it('tells the forms when the check is on a kana item (H.2.b)', async () => {
      findUnique.mockResolvedValue({
        ...typedCheck,
        targetItemId: 'ja:kana:ha',
        data: { answer: 'は' },
      });

      await service.grade('chk-1', 'wa', 'dev-user');

      expect(answerForms).toHaveBeenCalledWith('は', {
        kanaTarget: true,
        prompt: typedCheck.prompt,
      });
    });

    it('has no key when there are no forms', async () => {
      findUnique.mockResolvedValue(typedCheck);

      const result = await service.grade('chk-1', 'kipu', 'dev-user');

      expect(result).not.toHaveProperty('answerForms');
    });

    it('never comes with multiple choice or an open check', async () => {
      answerForms.mockReturnValue(forms);
      findUnique.mockResolvedValue(check);
      expect(await service.grade('chk-1', 'い', 'dev-user')).not.toHaveProperty(
        'answerForms',
      );

      findUnique.mockResolvedValue(openCheck);
      gradeOpen.mockResolvedValue({
        rating: 'Again',
        correct: false,
        feedback: '',
        exemplar: 'おはようございます',
        gradedBy: 'ai',
        scored: true,
      });
      expect(
        await service.grade('chk-open', 'inu', 'dev-user'),
      ).not.toHaveProperty('answerForms');
      expect(answerForms).not.toHaveBeenCalled();
    });

    describe('on real grading', () => {
      let writingEval: WritingEvalService;
      beforeAll(async () => {
        writingEval = new WritingEvalService();
        await writingEval.onModuleInit();
      }, 10_000);

      const grade = (row: object, typedIn: string) =>
        new ChecksService(
          { check: { findUnique: () => Promise.resolve(row) } } as never,
          { recordCheckResult } as never,
          {} as never,
          writingEval,
        ).grade('chk-1', typedIn, 'dev-user');

      it.each([
        ['きっぷ', 'ja:vocab:切符', 'kipu', 'kippu'],
        [
          'ともだち は いしゃ です',
          'ja:grammar:は',
          'tomodachi ga isha desu',
          'tomodachi wa isha desu',
        ],
        ['こんにちは', 'ja:vocab:今日は', 'konichiwa', 'konnichiwa'],
      ])(
        'shows %s as %s after a miss, and the rōmaji shown is then right',
        async (answer, targetItemId, wrong, romaji) => {
          const row = { ...typedCheck, targetItemId, data: { answer } };

          const missed = await grade(row, wrong);
          expect(missed.correct).toBe(false);
          expect(missed.answerForms).toEqual({ kana: answer, romaji });

          const retried = await grade(row, missed.answerForms!.romaji);
          expect(retried.correct).toBe(true);
        },
      );
    });
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
        scored: true,
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

    it('grades the shape the publisher writes for an open check (P10)', async () => {
      findUnique.mockResolvedValue({
        ...openCheck,
        data: { exemplar: 'はじめまして', rubric: 'Greeting and name.' },
      });
      gradeOpen.mockResolvedValue({
        rating: 'Good',
        correct: true,
        feedback: 'Nice.',
        exemplar: 'はじめまして',
        gradedBy: 'ai',
        scored: true,
      });

      const result = await service.grade('chk-open', 'こんにちは', 'dev-user');

      expect(gradeOpen).toHaveBeenCalledWith({
        prompt: openCheck.prompt,
        answer: 'こんにちは',
        exemplar: 'はじめまして',
        rubric: 'Greeting and name.',
      });
      expect(result.correct).toBe(true);
    });

    it('an answer that is exactly the exemplar still goes to the grader (G.4.h is recall-only)', async () => {
      findUnique.mockResolvedValue(openCheck);
      gradeOpen.mockResolvedValue({
        rating: 'Good',
        correct: true,
        feedback: 'Polite and natural.',
        exemplar: 'おはようございます',
        gradedBy: 'ai',
        scored: true,
      });

      const result = await service.grade(
        'chk-open',
        'おはようございます',
        'dev-user',
      );

      expect(gradeOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          answer: 'おはようございます',
          exemplar: 'おはようございます',
        }),
      );
      expect(result).toEqual({
        checkId: 'chk-open',
        correct: true,
        correctAnswer: 'おはようございます',
        scored: true,
        feedback: 'Polite and natural.',
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

    it('keeps a MULTIPLE_CHOICE check closed even if its stored answer is missing', async () => {
      // Misconfigured MC check (answer blank): must grade deterministically as
      // wrong, never route to the AI grader.
      findUnique.mockResolvedValue({
        ...check,
        data: { choices: ['あ'], answer: '' },
      });

      const result = await service.grade('chk-1', 'あ', 'dev-user');

      expect(gradeOpen).not.toHaveBeenCalled();
      expect(result.correct).toBe(false);
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

      // Learner still gets a response. The item is scheduled without a verdict.
      expect(result.correct).toBe(true);
      expect(recordCheckResult).not.toHaveBeenCalled();
      expect(seedInferred).toHaveBeenCalledWith('dev-user', [
        'ja:phrase:ohayou',
      ]);
    });

    it('does NOT write a miss to mastery when only the fallback said wrong', async () => {
      findUnique.mockResolvedValue(openCheck);
      gradeOpen.mockResolvedValue({
        rating: 'Again',
        correct: false,
        feedback: 'Not quite — the expected answer was: おはようございます.',
        exemplar: 'おはようございます',
        gradedBy: 'fallback',
        scored: true,
      });

      const result = await service.grade(
        'chk-open',
        'a right paraphrase',
        'dev-user',
      );

      // The learner still sees the result; the schedule doesn't pay for our outage.
      expect(result.correct).toBe(false);
      expect(recordCheckResult).not.toHaveBeenCalled();
      expect(seedInferred).toHaveBeenCalledWith('dev-user', [
        'ja:phrase:ohayou',
      ]);
    });

    it('still answers the learner when scheduling the ungraded item fails', async () => {
      findUnique.mockResolvedValue(openCheck);
      gradeOpen.mockResolvedValue({
        rating: 'Again',
        correct: false,
        feedback: '',
        exemplar: 'おはようございます',
        gradedBy: 'fallback',
        scored: true,
      });
      seedInferred.mockRejectedValue(new Error('db down'));

      await expect(
        service.grade('chk-open', 'a paraphrase', 'dev-user'),
      ).resolves.toMatchObject({ correct: false });
    });

    it('still writes an exact match the fallback marked right', async () => {
      findUnique.mockResolvedValue(openCheck);
      gradeOpen.mockResolvedValue({
        rating: 'Good',
        correct: true,
        feedback: 'Correct.',
        exemplar: 'おはようございます',
        gradedBy: 'fallback',
        scored: true,
      });

      await service.grade('chk-open', 'おはようございます', 'dev-user');

      expect(recordCheckResult).toHaveBeenCalledWith(
        expect.objectContaining({ rating: Rating.Good, correct: true }),
      );
      expect(seedInferred).not.toHaveBeenCalled();
    });

    it('still writes a blank answer as a miss, which no outage can explain', async () => {
      findUnique.mockResolvedValue(openCheck);
      gradeOpen.mockResolvedValue({
        rating: 'Again',
        correct: false,
        feedback: 'No answer was given.',
        exemplar: 'おはようございます',
        gradedBy: 'fallback',
        scored: true,
      });

      await service.grade('chk-open', '   ', 'dev-user');

      expect(recordCheckResult).toHaveBeenCalledWith(
        expect.objectContaining({ rating: Rating.Again, correct: false }),
      );
    });
  });

  describe('what an open check tells the learner (B.2.d, P1, P6)', () => {
    it("sends the model's comment with a scored verdict", async () => {
      findUnique.mockResolvedValue(openCheck);
      gradeOpen.mockResolvedValue({
        rating: 'Hard',
        correct: true,
        feedback: 'Good greeting and name; next time add what you do.',
        exemplar: 'おはようございます',
        gradedBy: 'ai',
        scored: true,
      });

      const result = await service.grade('chk-open', 'ohayou', 'dev-user');

      expect(result).toMatchObject({
        correct: true,
        scored: true,
        feedback: 'Good greeting and name; next time add what you do.',
      });
    });

    it('sends a closed check scored, with no comment', async () => {
      findUnique.mockResolvedValue(check);

      for (const answer of ['あ', 'い']) {
        const result = await service.grade('chk-1', answer, 'dev-user');
        expect(result.scored).toBe(true);
        expect(result).not.toHaveProperty('feedback');
      }
    });

    it('never passes on a fallback line as if it were a comment', async () => {
      findUnique.mockResolvedValue(openCheck);
      gradeOpen.mockResolvedValue({
        rating: 'Good',
        correct: true,
        feedback: 'Correct.',
        exemplar: 'おはようございます',
        gradedBy: 'fallback',
        scored: true,
      });

      const result = await service.grade(
        'chk-open',
        'おはようございます',
        'dev-user',
      );

      // An exact match the fallback could judge: a real verdict, no comment.
      expect(result).toEqual({
        checkId: 'chk-open',
        correct: true,
        correctAnswer: 'おはようございます',
        scored: true,
      });
    });

    describe('with the model unavailable, through the real grading service', () => {
      function realService() {
        const llm: LlmClient = {
          enabled: false,
          parseJson: () => Promise.reject(new Error('never called')),
        };
        return new ChecksService(
          { check: { findUnique }, user: { upsert: userUpsert } } as never,
          { recordCheckResult, seedInferred } as never,
          new GradingService(llm),
          {} as never,
        );
      }

      it('says it was not scored, with no comment, when there is a model answer', async () => {
        findUnique.mockResolvedValue(openCheck);

        const result = await realService().grade(
          'chk-open',
          'ohayou gozaimasu',
          'dev-user',
        );

        expect(result).toEqual({
          checkId: 'chk-open',
          correct: false,
          correctAnswer: 'おはようございます',
          scored: false,
        });
        // The item still reaches reviews, unscored.
        expect(recordCheckResult).not.toHaveBeenCalled();
        expect(seedInferred).toHaveBeenCalledWith('dev-user', [
          'ja:phrase:ohayou',
        ]);
      });

      it('says it was not scored, with no comment, when there is no model answer', async () => {
        findUnique.mockResolvedValue({ ...openCheck, data: {} });

        const result = await realService().grade(
          'chk-open',
          'anything',
          'dev-user',
        );

        expect(result).toEqual({
          checkId: 'chk-open',
          correct: true,
          correctAnswer: '',
          scored: false,
        });
        expect(recordCheckResult).not.toHaveBeenCalled();
        expect(seedInferred).toHaveBeenCalledWith('dev-user', [
          'ja:phrase:ohayou',
        ]);
      });

      it('still scores a blank answer as a miss, with no comment', async () => {
        findUnique.mockResolvedValue(openCheck);

        const result = await realService().grade('chk-open', '  ', 'dev-user');

        expect(result).toEqual({
          checkId: 'chk-open',
          correct: false,
          correctAnswer: 'おはようございます',
          scored: true,
        });
        expect(recordCheckResult).toHaveBeenCalledWith(
          expect.objectContaining({ rating: Rating.Again, correct: false }),
        );
      });
    });
  });

  describe('an outage on real mastery code (F1)', () => {
    type Row = Record<string, unknown> & { fsrs?: { stability: number } };
    type Key = { userId: string; itemId: string };
    const keyOf = (k: Key) => `${k.userId}:${k.itemId}`;

    /** Prisma's shape for the tables involved, including the user foreign key. */
    function setup(existing?: Row) {
      const users = new Set<string>();
      const rows = new Map<string, Row>();
      if (existing) rows.set(`u:${openCheck.targetItemId}`, existing);
      const prisma = {
        check: { findUnique: () => Promise.resolve(openCheck) },
        user: {
          upsert: ({ create }: { create: { id: string } }) => {
            users.add(create.id);
            return Promise.resolve({});
          },
        },
        itemMasteryState: {
          findMany: () =>
            Promise.resolve(
              [...rows.keys()].map((k) => ({
                itemId: k.slice(k.indexOf(':') + 1),
              })),
            ),
          createMany: ({ data }: { data: Array<Row & Key> }) => {
            for (const d of data) {
              if (!users.has(d.userId)) {
                return Promise.reject(new Error('foreign key violation'));
              }
              rows.set(keyOf(d), d);
            }
            return Promise.resolve({ count: data.length });
          },
        },
      };
      const llm: LlmClient = {
        enabled: true,
        parseJson: () =>
          Promise.reject(new LlmCallError('gone', 'model_unavailable', 'm')),
      };
      const realService = new ChecksService(
        prisma as never,
        new MasteryService(prisma as never),
        new GradingService(llm),
        {} as never,
      );
      return { rows, realService };
    }

    beforeEach(() => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation();
    });

    afterEach(() => jest.restoreAllMocks());

    it('still schedules a first-contact item, without recording an Again', async () => {
      const { rows, realService } = setup();
      const now = new Date();

      const result = await realService.grade('chk-open', 'a paraphrase', 'u');

      expect(result.correct).toBe(false); // what the learner sees is unchanged
      const row = rows.get('u:ja:phrase:ohayou');
      expect(row).toBeDefined(); // reaches Reviews and Practice
      const hard = applyRating(emptyCard(now), Rating.Hard, now);
      const again = applyRating(emptyCard(now), Rating.Again, now);
      expect(row?.fsrs?.stability).toBeCloseTo(hard.stability);
      expect(row?.fsrs?.stability).not.toBeCloseTo(again.stability);
      // No per-modality claim about an answer nobody judged.
      expect(row?.recall).toBeUndefined();
    });

    it('leaves an item already on the schedule alone', async () => {
      const original = { due: 'unchanged' };
      const { rows, realService } = setup(original);

      await realService.grade('chk-open', 'a paraphrase', 'u');

      expect(rows.get('u:ja:phrase:ohayou')).toBe(original);
    });
  });
});
