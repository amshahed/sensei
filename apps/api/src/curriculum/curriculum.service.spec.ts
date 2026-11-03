import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CurriculumService } from './curriculum.service';

const lesson = (id: string, position: number, minutes: number | null = 5) => ({
  id,
  slug: `slug-${id}`,
  title: `Lesson ${id}`,
  type: 'F_KANA',
  position,
  estimatedMinutes: minutes,
});

const chapter = (
  id: string,
  position: number,
  lessons: ReturnType<typeof lesson>[],
) => ({ id, slug: `ch-${id}`, title: `Chapter ${id}`, position, lessons });

/** Module m1: c1 [l1, l2], c-empty [], c2 [l3]; module m2: c3 [l4]; module m-empty: c-empty2 []. */
const modules = [
  {
    id: 'm1',
    slug: 'mod-1',
    title: 'Module 1',
    position: 1,
    chapters: [
      chapter('c1', 1, [lesson('l1', 1, 4), lesson('l2', 2, null)]),
      chapter('c-empty', 2, []),
      chapter('c2', 3, [lesson('l3', 1)]),
    ],
  },
  {
    id: 'm2',
    slug: 'mod-2',
    title: 'Module 2',
    position: 2,
    chapters: [chapter('c3', 1, [lesson('l4', 1)])],
  },
  {
    id: 'm-empty',
    slug: 'mod-empty',
    title: 'Empty',
    position: 3,
    chapters: [chapter('c-empty2', 1, [])],
  },
];

/** TARGET item rows (position order): l1 teaches あ then い; l3 teaches う. */
const keyItemRows = [
  {
    lessonId: 'l1',
    item: { id: 'a', display: 'あ', reading: 'あ', meaning: null },
  },
  {
    lessonId: 'l3',
    item: { id: 'u', display: 'う', reading: 'う', meaning: null },
  },
  {
    lessonId: 'l1',
    item: { id: 'i', display: 'い', reading: 'い', meaning: null },
  },
];

describe('CurriculumService', () => {
  let service: CurriculumService;
  let moduleFindMany: jest.Mock;
  let lessonItemFindMany: jest.Mock;
  let completionFindMany: jest.Mock;
  let markFindMany: jest.Mock;
  let skipFindMany: jest.Mock;
  let userFindUnique: jest.Mock;
  let userUpsert: jest.Mock;
  let userUpdateMany: jest.Mock;

  beforeEach(async () => {
    moduleFindMany = jest.fn().mockResolvedValue(modules);
    lessonItemFindMany = jest.fn().mockResolvedValue(keyItemRows);
    completionFindMany = jest.fn().mockResolvedValue([]);
    markFindMany = jest.fn().mockResolvedValue([]);
    skipFindMany = jest.fn().mockResolvedValue([]);
    userFindUnique = jest.fn().mockResolvedValue(null);
    userUpsert = jest.fn().mockResolvedValue({});
    userUpdateMany = jest.fn().mockResolvedValue({ count: 1 });

    const moduleRef = await Test.createTestingModule({
      providers: [
        CurriculumService,
        {
          provide: PrismaService,
          useValue: {
            module: { findMany: moduleFindMany },
            lessonItem: { findMany: lessonItemFindMany },
            lessonCompletion: { findMany: completionFindMany },
            userChapterMark: { findMany: markFindMany },
            userLessonSkip: { findMany: skipFindMany },
            user: {
              findUnique: userFindUnique,
              upsert: userUpsert,
              updateMany: userUpdateMany,
            },
          },
        },
      ],
    }).compile();
    service = moduleRef.get(CurriculumService);
  });

  describe('getCurriculum', () => {
    it('loads the Japanese tree and TARGET items, scoped to the user', async () => {
      await service.getCurriculum('u1');
      expect(moduleFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { language: 'ja' } }),
      );
      expect(lessonItemFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            role: 'TARGET',
            lesson: { chapter: { module: { language: 'ja' } } },
          },
          orderBy: { position: 'asc' },
        }),
      );
      for (const m of [completionFindMany, markFindMany]) {
        expect(m).toHaveBeenCalledWith(
          expect.objectContaining({ where: { userId: 'u1' } }),
        );
      }
      expect(userFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u1' } }),
      );
    });

    it('hides chapters without lessons and modules left empty', async () => {
      const dto = await service.getCurriculum('u1');
      expect(dto.modules.map((m) => m.id)).toEqual(['m1', 'm2']);
      expect(dto.modules[0].chapters.map((c) => c.id)).toEqual(['c1', 'c2']);
    });

    it('shapes chapters and lessons for a new learner', async () => {
      const dto = await service.getCurriculum('u1');
      const [c1, c2] = dto.modules[0].chapters;

      expect(c1).toMatchObject({
        id: 'c1',
        slug: 'ch-c1',
        lessonCount: 2,
        estimatedMinutes: 4, // null minutes count as 0
        state: 'current',
        actions: { relocate: false, assessment: true, review: false },
      });
      expect(c1.lessons[0]).toEqual({
        id: 'l1',
        slug: 'slug-l1',
        title: 'Lesson l1',
        type: 'F_KANA',
        position: 1,
        estimatedMinutes: 4,
        state: 'current',
        keyItems: [
          { id: 'a', display: 'あ', reading: 'あ', meaning: null },
          { id: 'i', display: 'い', reading: 'い', meaning: null },
        ],
      });
      expect(c1.lessons[1]).toMatchObject({
        state: 'not_started',
        keyItems: [],
      });
      expect(c2.lessons[0].keyItems.map((i) => i.id)).toEqual(['u']);
      expect(c2.state).toBe('available'); // next-chapter lookahead (I.4.e.a)
      expect(dto.modules[1].chapters[0].state).toBe('locked');
      expect(dto.currentChapterId).toBe('c1');
      expect(dto.relocated).toBe(false);
      expect(dto.next).toEqual({
        kind: 'lesson',
        slug: 'slug-l1',
        title: 'Lesson l1',
        chapterId: 'c1',
        chapterTitle: 'Chapter c1',
        chapterStart: true, // nothing in c1 done yet → skip-test offer
      });
    });

    it('feeds completions, lesson skips and chapter marks into the state', async () => {
      completionFindMany.mockResolvedValue([
        { lessonId: 'l1' },
        { lessonId: 'l2' },
      ]);
      markFindMany.mockResolvedValue([
        { chapterId: 'c1', kind: 'PASSED_ASSESSMENT' },
        { chapterId: 'c2', kind: 'PASSED_ASSESSMENT' },
      ]);
      skipFindMany.mockResolvedValue([{ lessonId: 'l4' }]);
      const dto = await service.getCurriculum('u1');
      const states = dto.modules.flatMap((m) => m.chapters.map((c) => c.state));
      expect(states).toEqual(['completed', 'completed', 'current']);
      expect(dto.modules[0].chapters[1].lessons[0].state).toBe('skipped');
      expect(dto.modules[1].chapters[0].lessons[0].state).toBe('skipped');
      // c3's only lesson was collapsed → its exit Assessment is next.
      expect(dto.next).toEqual({
        kind: 'assessment',
        chapterId: 'c3',
        chapterTitle: 'Chapter c3',
      });
      expect(skipFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' } }),
      );
    });

    it('offers the exit Assessment once the lessons are done (they never pass a chapter alone)', async () => {
      completionFindMany.mockResolvedValue([
        { lessonId: 'l1' },
        { lessonId: 'l2' },
      ]);
      const dto = await service.getCurriculum('u1');
      expect(dto.modules[0].chapters[0]).toMatchObject({
        state: 'current',
        actions: { assessment: true },
      });
      expect(dto.next).toEqual({
        kind: 'assessment',
        chapterId: 'c1',
        chapterTitle: 'Chapter c1',
      });
    });

    it('returns nothing next once every chapter is passed', async () => {
      markFindMany.mockResolvedValue(
        ['c1', 'c2', 'c3'].map((chapterId) => ({
          chapterId,
          kind: 'PASSED_ASSESSMENT',
        })),
      );
      const dto = await service.getCurriculum('u1');
      expect(dto.currentChapterId).toBeNull();
      expect(dto.next).toBeNull();
    });

    it('honours a valid relocation and leaves the pointer alone', async () => {
      markFindMany.mockResolvedValue([
        { chapterId: 'c1', kind: 'SKIPPED_VIA_PLACEMENT' },
      ]);
      userFindUnique.mockResolvedValue({ currentChapterId: 'c1' });
      const dto = await service.getCurriculum('u1');
      expect(dto).toMatchObject({ currentChapterId: 'c1', relocated: true });
      // Already passed: no skip-test offer on entering it again.
      expect(dto.next).toMatchObject({ kind: 'lesson', chapterStart: false });
      expect(userUpdateMany).not.toHaveBeenCalled();
    });

    it('clears a lapsed pointer so it cannot come back later', async () => {
      // Relocated to c1, then learned it: the pointer is no longer honoured.
      markFindMany.mockResolvedValue([
        { chapterId: 'c1', kind: 'SKIPPED_VIA_PLACEMENT' },
      ]);
      completionFindMany.mockResolvedValue([
        { lessonId: 'l1' },
        { lessonId: 'l2' },
      ]);
      userFindUnique.mockResolvedValue({ currentChapterId: 'c1' });
      const dto = await service.getCurriculum('u1');
      expect(dto).toMatchObject({ currentChapterId: 'c2', relocated: false });
      expect(userUpdateMany).toHaveBeenCalledWith({
        where: { id: 'u1', currentChapterId: 'c1' },
        data: { currentChapterId: null },
      });
    });
  });

  describe('getNext', () => {
    it('returns only the next lesson, without loading key items', async () => {
      completionFindMany.mockResolvedValue([{ lessonId: 'l1' }]);
      await expect(service.getNext('u1')).resolves.toEqual({
        next: {
          kind: 'lesson',
          slug: 'slug-l2',
          title: 'Lesson l2',
          chapterId: 'c1',
          chapterTitle: 'Chapter c1',
          chapterStart: false, // l1 already done
        },
      });
      expect(lessonItemFindMany).not.toHaveBeenCalled();
    });

    it('also clears a lapsed pointer', async () => {
      userFindUnique.mockResolvedValue({ currentChapterId: 'gone' });
      await service.getNext('u1');
      expect(userUpdateMany).toHaveBeenCalledWith({
        where: { id: 'u1', currentChapterId: 'gone' },
        data: { currentChapterId: null },
      });
    });
  });

  describe('relocate', () => {
    beforeEach(() => {
      // c1 skipped by placement; frontier = c2.
      markFindMany.mockResolvedValue([
        { chapterId: 'c1', kind: 'SKIPPED_VIA_PLACEMENT' },
      ]);
    });

    it('404s for an unknown (or hidden empty) chapter', async () => {
      await expect(service.relocate('u1', 'nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.relocate('u1', 'c-empty')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(userUpsert).not.toHaveBeenCalled();
    });

    it('400s for a chapter that cannot be relocated to (incl. the frontier)', async () => {
      for (const id of ['c2', 'c3']) {
        await expect(service.relocate('u1', id)).rejects.toBeInstanceOf(
          BadRequestException,
        );
      }
      expect(userUpsert).not.toHaveBeenCalled();
    });

    it('points the user at a skipped chapter and returns the outline from one load', async () => {
      const dto = await service.relocate('u1', 'c1');
      expect(userUpsert).toHaveBeenCalledWith({
        where: { id: 'u1' },
        update: { currentChapterId: 'c1' },
        create: { id: 'u1', currentChapterId: 'c1' },
      });
      expect(dto).toMatchObject({ currentChapterId: 'c1', relocated: true });
      expect(dto.next).toMatchObject({ kind: 'lesson', slug: 'slug-l1' });
      expect(moduleFindMany).toHaveBeenCalledTimes(1);
      expect(userFindUnique).toHaveBeenCalledTimes(1);
    });

    it('null returns to the furthest point', async () => {
      userFindUnique.mockResolvedValue({ currentChapterId: 'c1' });
      const dto = await service.relocate('u1', null);
      expect(userUpsert).toHaveBeenCalledWith({
        where: { id: 'u1' },
        update: { currentChapterId: null },
        create: { id: 'u1', currentChapterId: null },
      });
      expect(dto).toMatchObject({ currentChapterId: 'c2', relocated: false });
    });
  });
});
