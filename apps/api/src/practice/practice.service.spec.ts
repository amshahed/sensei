import { StreakService } from '../streak/streak.service';
import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Rating } from 'ts-fsrs';
import { PracticeService, PRACTICE_SESSION_SIZE } from './practice.service';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from '../mastery/mastery.service';
import { GradingService } from '../grading/grading.service';
import { RecallGraderService } from '../recall/recall-grader.service';
import { WritingEvalService } from '../writing-eval/writing-eval.service';
import { applyRating, emptyCard, serializeCard } from '../mastery/fsrs';
import type { ItemMasteryDto } from '@sensei/types';

const NOW = new Date('2026-11-04T12:00:00.000Z');
const DAY = 86_400_000;

/** A stored FSRS card last reviewed `daysAgo` days before NOW (older → lower retention). */
function cardReviewed(daysAgo: number) {
  const at = new Date(NOW.getTime() - daysAgo * DAY);
  return serializeCard(applyRating(emptyCard(at), Rating.Good, at));
}

const kana = (romaji: string) => ({
  id: `ja:kana:${romaji}`,
  type: 'KANA' as const,
  display: romaji,
  reading: romaji,
  meaning: null,
  data: { romaji },
});
const vocab = {
  id: 'ja:vocab:すし',
  type: 'VOCAB' as const,
  display: 'すし',
  reading: 'すし',
  meaning: 'sushi',
  data: {},
};
/** KANA with no rōmaji: nothing to check against, never drillable. */
const unquizzable = {
  id: 'ja:kana:broken',
  type: 'KANA' as const,
  display: '?',
  reading: null,
  meaning: null,
  data: {},
};

function state(
  item: { id: string },
  daysAgo: number,
  modality: { recognition?: number; recall?: number; production?: number } = {},
) {
  return {
    fsrs: cardReviewed(daysAgo),
    recognition: 0.5,
    recall: 0.5,
    production: 0.5,
    ...modality,
    item,
  };
}

describe('PracticeService', () => {
  const streakRecord = jest.fn().mockResolvedValue(undefined);
  let service: PracticeService;
  let statesFindMany: jest.Mock;
  let stateFindUnique: jest.Mock;
  let lessonItemFindMany: jest.Mock;
  let chapterFindUnique: jest.Mock;
  let moduleFindUnique: jest.Mock;
  let sessionCreate: jest.Mock;
  let sessionFindUnique: jest.Mock;
  let attemptCreateMany: jest.Mock;
  let itemFindUnique: jest.Mock;
  let recordCheckResult: jest.SpyInstance;
  let gradeOpen: jest.Mock;
  let prisma: Record<string, unknown>;

  beforeEach(async () => {
    statesFindMany = jest.fn().mockResolvedValue([]);
    stateFindUnique = jest.fn().mockResolvedValue({ mastery: 0.4 });
    lessonItemFindMany = jest.fn().mockResolvedValue([]);
    chapterFindUnique = jest.fn().mockResolvedValue({ id: 'ch-1' });
    moduleFindUnique = jest.fn().mockResolvedValue({ id: 'mod-1' });
    sessionCreate = jest.fn().mockResolvedValue({ id: 'ps-1' });
    sessionFindUnique = jest.fn();
    attemptCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    itemFindUnique = jest.fn();
    gradeOpen = jest.fn();
    prisma = {
      // Interactive transactions run against the same mock (the tx client).
      $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
      itemMasteryState: {
        findMany: statesFindMany,
        findUnique: stateFindUnique,
      },
      lessonItem: { findMany: lessonItemFindMany },
      chapter: { findUnique: chapterFindUnique },
      module: { findUnique: moduleFindUnique },
      practiceSession: {
        create: sessionCreate,
        findUnique: sessionFindUnique,
      },
      practiceAttempt: { createMany: attemptCreateMany },
      item: { findUnique: itemFindUnique },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PracticeService,
        { provide: StreakService, useValue: { record: streakRecord } },
        { provide: PrismaService, useValue: prisma },
        MasteryService, // real learned-item query + ranking over the mock
        RecallGraderService, // real shared grader over mocked AI + normaliser
        { provide: GradingService, useValue: { gradeOpen } },
        {
          provide: WritingEvalService,
          useValue: { exactMatch: (a: string, b: string) => a === b },
        },
      ],
    }).compile();
    service = moduleRef.get(PracticeService);
    recordCheckResult = jest
      .spyOn(moduleRef.get(MasteryService), 'recordCheckResult')
      .mockResolvedValue({ mastery: 0.6 } as ItemMasteryDto);
  });

  describe('scopes', () => {
    const placement = (
      itemId: string,
      chapter: { id: string; position: number },
      mod: { id: string; position: number },
    ) => ({
      itemId,
      lesson: {
        chapter: {
          id: chapter.id,
          title: `Chapter ${chapter.id}`,
          position: chapter.position,
          module: {
            id: mod.id,
            title: `Module ${mod.id}`,
            position: mod.position,
          },
        },
      },
    });

    it('counts learned, quizzable items per module / chapter / type, in course order', async () => {
      statesFindMany.mockResolvedValue([
        state(kana('a'), 1),
        state(kana('i'), 1),
        state(vocab, 1),
        state(unquizzable, 1),
      ]);
      const m1 = { id: 'm1', position: 1 };
      const m2 = { id: 'm2', position: 2 };
      lessonItemFindMany.mockResolvedValue([
        placement('ja:vocab:すし', { id: 'c3', position: 1 }, m2),
        placement('ja:kana:i', { id: 'c2', position: 2 }, m1),
        placement('ja:kana:a', { id: 'c1', position: 1 }, m1),
        // The same item taught again in a later lesson of the same chapter.
        placement('ja:kana:a', { id: 'c1', position: 1 }, m1),
      ]);

      const scopes = await service.scopes('u1');

      expect(scopes.learned).toEqual({
        KANA: 2,
        VOCAB: 1,
        KANJI: 0,
        GRAMMAR: 0,
      });
      expect(scopes.modules.map((m) => m.id)).toEqual(['m1', 'm2']);
      expect(scopes.modules[0]).toMatchObject({
        title: 'Module m1',
        learned: { KANA: 2, VOCAB: 0, KANJI: 0, GRAMMAR: 0 },
        chapters: [
          { id: 'c1', learned: { KANA: 1, VOCAB: 0, KANJI: 0, GRAMMAR: 0 } },
          { id: 'c2', learned: { KANA: 1, VOCAB: 0, KANJI: 0, GRAMMAR: 0 } },
        ],
      });
      // Only learned, quizzable items are placed in the outline.
      const [[placementQuery]] = lessonItemFindMany.mock.calls as [
        [{ where: { itemId: { in: string[] }; role: string } }],
      ];
      expect(placementQuery.where.role).toBe('TARGET');
      expect(placementQuery.where.itemId.in.sort()).toEqual(
        ['ja:kana:a', 'ja:kana:i', 'ja:vocab:すし'].sort(),
      );
    });

    it('a brand-new learner has nothing to drill', async () => {
      const scopes = await service.scopes('u1');
      expect(scopes).toEqual({
        learned: { KANA: 0, VOCAB: 0, KANJI: 0, GRAMMAR: 0 },
        modules: [],
      });
    });
  });

  describe('start', () => {
    it('serves a word spelled with kanji in kana (G.4.c)', async () => {
      statesFindMany.mockResolvedValue([
        state({ ...vocab, display: '母', reading: 'はは' } as typeof vocab, 1),
      ]);
      const session = await service.start(
        'u1',
        { scope: { kind: 'weakest' } },
        NOW,
      );
      expect(session.items[0]).toMatchObject({
        display: 'はは',
        prompt: 'What does 「はは」 mean?',
      });
    });

    it('weakest: lowest retention first, then weakest modality; answers never leak', async () => {
      statesFindMany.mockResolvedValue([
        state(kana('a'), 1),
        state(kana('i'), 30), // reviewed longest ago → lowest retention
        state(kana('u'), 5, { recall: 0.9 }),
        state(kana('e'), 5, { production: 0.1 }), // same retention, weaker modality
        state(unquizzable, 100),
      ]);

      const session = await service.start(
        'u1',
        { scope: { kind: 'weakest' } },
        NOW,
      );

      expect(session.sessionId).toBe('ps-1');
      expect(session.items.map((i) => i.itemId)).toEqual([
        'ja:kana:i',
        'ja:kana:e',
        'ja:kana:u',
        'ja:kana:a',
      ]);
      expect(session.items[0]).toEqual({
        itemId: 'ja:kana:i',
        type: 'KANA',
        display: 'i',
        prompt: 'Type the rōmaji for 「i」',
      });
      expect(sessionCreate).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          scope: { kind: 'weakest' },
          itemIds: ['ja:kana:i', 'ja:kana:e', 'ja:kana:u', 'ja:kana:a'],
        },
        select: { id: true },
      });
      // Learned items only: the query never reaches beyond mastery records,
      // and "weakest" isn't limited to any lesson's items.
      const [[query]] = statesFindMany.mock.calls as [
        [{ where: { userId: string; itemId?: unknown } }],
      ];
      expect(query.where.userId).toBe('u1');
      expect(query.where.itemId).toBeUndefined();
      expect(lessonItemFindMany).not.toHaveBeenCalled();
    });

    it(`caps a session at ${PRACTICE_SESSION_SIZE} items`, async () => {
      statesFindMany.mockResolvedValue(
        Array.from({ length: 30 }, (_, i) => state(kana(`k${i}`), i)),
      );
      const session = await service.start(
        'u1',
        { scope: { kind: 'weakest' } },
        NOW,
      );
      expect(session.items).toHaveLength(PRACTICE_SESSION_SIZE);
      expect(session.items[0].itemId).toBe('ja:kana:k29');
    });

    it('filters by item type and records the filter on the session', async () => {
      statesFindMany.mockResolvedValue([state(kana('a'), 1), state(vocab, 1)]);
      const session = await service.start(
        'u1',
        { scope: { kind: 'weakest' }, types: ['VOCAB'] },
        NOW,
      );
      expect(session.items.map((i) => i.itemId)).toEqual(['ja:vocab:すし']);
      expect(sessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scope: { kind: 'weakest', types: ['VOCAB'] },
          }) as unknown,
        }),
      );
    });

    it('chapter scope: only the chapter’s taught items are drilled', async () => {
      lessonItemFindMany.mockResolvedValue([
        { itemId: 'ja:kana:a' },
        { itemId: 'ja:kana:a' },
        { itemId: 'ja:kana:i' },
      ]);
      statesFindMany.mockResolvedValue([state(kana('a'), 1)]);

      const session = await service.start(
        'u1',
        { scope: { kind: 'chapter', id: 'ch-1' } },
        NOW,
      );

      expect(session.items.map((i) => i.itemId)).toEqual(['ja:kana:a']);
      expect(lessonItemFindMany).toHaveBeenCalledWith({
        where: { role: 'TARGET', lesson: { chapterId: 'ch-1' } },
        select: { itemId: true },
      });
      const [[query]] = statesFindMany.mock.calls as [
        [{ where: { itemId: { in: string[] } } }],
      ];
      expect(query.where.itemId.in).toEqual(['ja:kana:a', 'ja:kana:i']);
    });

    it('module scope covers every chapter of the module', async () => {
      await service.start(
        'u1',
        { scope: { kind: 'module', id: 'mod-1' } },
        NOW,
      );
      expect(lessonItemFindMany).toHaveBeenCalledWith({
        where: { role: 'TARGET', lesson: { chapter: { moduleId: 'mod-1' } } },
        select: { itemId: true },
      });
    });

    it('404s for an unknown chapter or module', async () => {
      chapterFindUnique.mockResolvedValue(null);
      moduleFindUnique.mockResolvedValue(null);
      await expect(
        service.start('u1', { scope: { kind: 'chapter', id: 'nope' } }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.start('u1', { scope: { kind: 'module', id: 'nope' } }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('nothing learned in scope: no session is created', async () => {
      const session = await service.start(
        'u1',
        { scope: { kind: 'weakest' } },
        NOW,
      );
      expect(session).toEqual({ sessionId: null, items: [] });
      expect(sessionCreate).not.toHaveBeenCalled();
    });
  });

  describe('answer', () => {
    beforeEach(() => {
      sessionFindUnique.mockResolvedValue({
        userId: 'u1',
        itemIds: ['ja:kana:a', 'ja:vocab:すし'],
      });
      itemFindUnique.mockImplementation(
        ({ where: { id } }: { where: { id: string } }) =>
          Promise.resolve(id === vocab.id ? vocab : kana('a')),
      );
    });

    it('the first answer to an item counts toward FSRS, like a review', async () => {
      const result = await service.answer('u1', 'ps-1', {
        itemId: 'ja:kana:a',
        answer: 'A',
      });

      expect(result).toEqual({
        itemId: 'ja:kana:a',
        correct: true,
        correctAnswer: 'a',
        scored: true,
        counted: true,
        mastery: 0.6,
      });
      expect(attemptCreateMany).toHaveBeenCalledWith({
        data: [{ sessionId: 'ps-1', itemId: 'ja:kana:a', correct: true }],
        skipDuplicates: true,
      });
      // Written through the transaction client the claim was made on.
      expect(recordCheckResult).toHaveBeenCalledWith(
        {
          userId: 'u1',
          itemId: 'ja:kana:a',
          format: 'TYPED',
          correct: true,
          rating: undefined,
        },
        prisma,
      );
    });

    it('every answer counts as effort toward the daily target, repeats included (K.3.b)', async () => {
      streakRecord.mockClear();
      await service.answer('u1', 'ps-1', { itemId: 'ja:kana:a', answer: 'a' });
      attemptCreateMany.mockResolvedValue({ count: 0 });
      await service.answer('u1', 'ps-1', { itemId: 'ja:kana:a', answer: 'a' });
      expect(streakRecord).toHaveBeenCalledTimes(2);
      expect(streakRecord).toHaveBeenLastCalledWith('u1', {
        kind: 'answers',
        count: 1,
      });
    });

    it('a repeat in the same session is exposure-only (double-count guardrail)', async () => {
      attemptCreateMany.mockResolvedValue({ count: 0 });

      const result = await service.answer('u1', 'ps-1', {
        itemId: 'ja:kana:a',
        answer: 'a',
      });

      expect(result).toMatchObject({
        correct: true,
        counted: false,
        mastery: 0.4,
      });
      expect(recordCheckResult).not.toHaveBeenCalled();
    });

    it('grader down and fallback says wrong: not scored, slot not claimed', async () => {
      gradeOpen.mockResolvedValue({
        rating: 'Again',
        correct: false,
        gradedBy: 'fallback',
        scored: true,
      });

      const result = await service.answer('u1', 'ps-1', {
        itemId: vocab.id,
        answer: 'raw fish rice',
      });

      expect(result).toMatchObject({
        scored: false,
        counted: false,
        mastery: 0.4,
      });
      expect(attemptCreateMany).not.toHaveBeenCalled();
      expect(recordCheckResult).not.toHaveBeenCalled();
    });

    it('a failed FSRS write fails the claim with it (one transaction)', async () => {
      const tx = jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(prisma));
      prisma.$transaction = tx;
      recordCheckResult.mockRejectedValue(new Error('db down'));

      await expect(
        service.answer('u1', 'ps-1', { itemId: 'ja:kana:a', answer: 'a' }),
      ).rejects.toThrow('db down');
      // The claim was made inside the transaction that then rolled back.
      expect(tx).toHaveBeenCalledTimes(1);
      expect(attemptCreateMany).toHaveBeenCalledTimes(1);
    });

    it('404s for a missing session or another learner’s', async () => {
      await expect(
        service.answer('u2', 'ps-1', { itemId: 'ja:kana:a', answer: 'a' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      sessionFindUnique.mockResolvedValue(null);
      await expect(
        service.answer('u1', 'nope', { itemId: 'ja:kana:a', answer: 'a' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('400s for an item outside the session', async () => {
      await expect(
        service.answer('u1', 'ps-1', { itemId: 'ja:kana:i', answer: 'i' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(attemptCreateMany).not.toHaveBeenCalled();
    });

    it('400s when the item has become unquizzable', async () => {
      itemFindUnique.mockResolvedValue(unquizzable);
      sessionFindUnique.mockResolvedValue({
        userId: 'u1',
        itemIds: [unquizzable.id],
      });
      await expect(
        service.answer('u1', 'ps-1', { itemId: unquizzable.id, answer: 'x' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
