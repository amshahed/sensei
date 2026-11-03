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
  items: [
    {
      item: {
        id: `item-${id}`,
        display: 'あ',
        reading: 'あ',
        meaning: null,
      },
    },
  ],
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

describe('CurriculumService', () => {
  let service: CurriculumService;
  let moduleFindMany: jest.Mock;
  let completionFindMany: jest.Mock;
  let markFindMany: jest.Mock;
  let userFindUnique: jest.Mock;
  let userUpsert: jest.Mock;

  beforeEach(async () => {
    moduleFindMany = jest.fn().mockResolvedValue(modules);
    completionFindMany = jest.fn().mockResolvedValue([]);
    markFindMany = jest.fn().mockResolvedValue([]);
    userFindUnique = jest.fn().mockResolvedValue(null);
    userUpsert = jest.fn().mockResolvedValue({});

    const moduleRef = await Test.createTestingModule({
      providers: [
        CurriculumService,
        {
          provide: PrismaService,
          useValue: {
            module: { findMany: moduleFindMany },
            lessonCompletion: { findMany: completionFindMany },
            userChapterMark: { findMany: markFindMany },
            user: { findUnique: userFindUnique, upsert: userUpsert },
          },
        },
      ],
    }).compile();
    service = moduleRef.get(CurriculumService);
  });

  describe('getCurriculum', () => {
    it('loads the Japanese tree scoped to the user', async () => {
      await service.getCurriculum('u1');
      expect(moduleFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { language: 'ja' } }),
      );
      expect(completionFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' } }),
      );
      expect(markFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' } }),
      );
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
        actions: { relocate: false, skipTest: true, review: false },
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
          { id: 'item-l1', display: 'あ', reading: 'あ', meaning: null },
        ],
      });
      expect(c1.lessons[1].state).toBe('not_started');
      expect(c2.state).toBe('available'); // next-chapter lookahead (I.4.e.a)
      expect(dto.modules[1].chapters[0].state).toBe('locked');
      expect(dto.currentChapterId).toBe('c1');
      expect(dto.nextLesson).toEqual({ slug: 'slug-l1', title: 'Lesson l1' });
    });

    it('feeds completions and chapter marks into the state', async () => {
      completionFindMany.mockResolvedValue([
        { lessonId: 'l1' },
        { lessonId: 'l2' },
      ]);
      markFindMany.mockResolvedValue([
        { chapterId: 'c2', kind: 'PASSED_SKIP_TEST' },
      ]);
      const dto = await service.getCurriculum('u1');
      const states = dto.modules.flatMap((m) => m.chapters.map((c) => c.state));
      expect(states).toEqual(['completed', 'completed', 'current']);
      expect(dto.modules[0].chapters[1].lessons[0].state).toBe('skipped');
      expect(dto.nextLesson?.slug).toBe('slug-l4');
    });

    it('returns no next lesson once everything is passed', async () => {
      completionFindMany.mockResolvedValue(
        ['l1', 'l2', 'l3', 'l4'].map((lessonId) => ({ lessonId })),
      );
      const dto = await service.getCurriculum('u1');
      expect(dto.currentChapterId).toBeNull();
      expect(dto.nextLesson).toBeNull();
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

    it('400s for a chapter that cannot be relocated to', async () => {
      await expect(service.relocate('u1', 'c3')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(userUpsert).not.toHaveBeenCalled();
    });

    it('points the user at a skipped chapter and returns the updated outline', async () => {
      userFindUnique
        .mockResolvedValueOnce(null) // relocate's own load
        .mockResolvedValueOnce({ currentChapterId: 'c1' }); // re-read after write
      const dto = await service.relocate('u1', 'c1');
      expect(userUpsert).toHaveBeenCalledWith({
        where: { id: 'u1' },
        update: { currentChapterId: 'c1' },
        create: { id: 'u1', currentChapterId: 'c1' },
      });
      expect(dto.currentChapterId).toBe('c1');
      expect(dto.nextLesson?.slug).toBe('slug-l1');
    });

    it('clears the pointer when going back to the frontier', async () => {
      userFindUnique.mockResolvedValue({ currentChapterId: 'c1' });
      await service.relocate('u1', 'c2');
      expect(userUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { currentChapterId: null },
          create: { id: 'u1', currentChapterId: null },
        }),
      );
    });
  });
});
