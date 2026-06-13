import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { PrismaService } from '../prisma/prisma.service';

// Shaped like the Prisma payload the service queries (only fields the mapper reads).
const lessonFixture = {
  id: 'lesson-1',
  slug: 'the-five-vowels',
  title: 'The Five Vowels あいうえお',
  type: 'F_KANA',
  position: 1,
  estimatedMinutes: 5,
  teach: { blocks: [{ kind: 'heading', text: 'The Five Vowels' }] },
  chapter: {
    id: 'ch-1',
    title: 'Hiragana — Vowels',
    module: { id: 'mod-1', title: 'Foundation (Japanese)' },
  },
  items: [
    {
      role: 'TARGET',
      item: {
        id: 'ja:kana:a',
        language: 'ja',
        type: 'KANA',
        display: 'あ',
        reading: 'あ',
        meaning: null,
      },
    },
  ],
  checks: [
    {
      id: 'chk-1',
      position: 0,
      prompt: 'Which kana is read “a”?',
      format: 'MULTIPLE_CHOICE',
      targetItemId: 'ja:kana:a',
      data: { choices: ['あ', 'い', 'う'], answer: 'あ' },
    },
  ],
};

describe('LessonsService', () => {
  let service: LessonsService;
  let findFirst: jest.Mock;

  beforeEach(async () => {
    findFirst = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        LessonsService,
        { provide: PrismaService, useValue: { lesson: { findFirst } } },
      ],
    }).compile();
    service = moduleRef.get(LessonsService);
  });

  it('maps a lesson to a DTO and exposes choices', async () => {
    findFirst.mockResolvedValue(lessonFixture);

    const dto = await service.getByIdOrSlug('the-five-vowels');

    expect(dto.slug).toBe('the-five-vowels');
    expect(dto.type).toBe('F_KANA');
    expect(dto.module.title).toBe('Foundation (Japanese)');
    expect(dto.chapter.title).toBe('Hiragana — Vowels');
    expect(dto.items).toHaveLength(1);
    expect(dto.items[0]).toMatchObject({
      id: 'ja:kana:a',
      display: 'あ',
      role: 'TARGET',
    });
    expect(dto.checks[0].choices).toEqual(['あ', 'い', 'う']);
  });

  it('never leaks the correct answer to the client', async () => {
    findFirst.mockResolvedValue(lessonFixture);

    const dto = await service.getByIdOrSlug('the-five-vowels');

    expect(
      (dto.checks[0] as unknown as Record<string, unknown>).answer,
    ).toBeUndefined();
  });

  it('throws NotFound when the lesson does not exist', async () => {
    findFirst.mockResolvedValue(null);

    await expect(service.getByIdOrSlug('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
