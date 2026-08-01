import { PrismaClient } from '@prisma/client';
import type { LessonType, CheckFormat } from '@prisma/client';
import type { LessonDraft } from './lesson-schema';
import type { Skeleton } from './skeleton-schema';

export interface PublishResult {
  lessonSlug: string;
  lessonDbId: string;
  created: boolean;
  itemsLinked: number;
  checksWritten: number;
}

const LESSON_TYPE_MAP: Partial<Record<string, LessonType>> = {
  'F-Kana': 'F_KANA',
  'F-Vocab': 'F_VOCAB',
  'F-Kanji': 'F_KANJI',
  'F-Grammar': 'F_GRAMMAR',
  'I-Listening': 'I_LISTENING',
  'I-Reading': 'I_READING',
  'I-Writing': 'I_WRITING',
  'I-Speaking': 'I_SPEAKING',
};

const CHECK_FORMAT_MAP: Partial<Record<string, CheckFormat>> = {
  'multiple-choice': 'MULTIPLE_CHOICE',
  typed: 'TYPED',
  spoken: 'SPOKEN',
};

/**
 * Convert authoring-format teach blocks ({ type, text/md }) to the canonical
 * runtime format ({ kind, text }) before writing to the DB so the mobile parser
 * always reads one consistent shape.
 */
function normaliseTeach(teach: LessonDraft['teach']): Record<string, unknown> {
  return {
    blocks: teach.blocks.map((block) => {
      const { type, ...rest } = block as Record<string, unknown>;
      // TextBlock legacy `md` field renamed to `text` for runtime uniformity.
      if (type === 'text' && 'md' in rest && !('text' in rest)) {
        const { md, ...remaining } = rest as Record<string, unknown>;
        return { kind: 'text', text: md, ...remaining };
      }
      return { kind: type, ...rest };
    }),
  };
}

interface SkeletonContext {
  moduleSlug: string;
  moduleTitle: string;
  moduleLanguage: string;
  modulePosition: number;
  chapterSlug: string;
  chapterTitle: string;
  chapterPosition: number;
  lessonPosition: number;
  estimatedMinutes: number;
}

function findSkeletonContext(
  skeleton: Skeleton,
  lessonId: string,
): SkeletonContext | null {
  const mod = skeleton.module;
  for (let ci = 0; ci < mod.chapters.length; ci++) {
    const ch = mod.chapters[ci];
    for (let li = 0; li < ch.lessons.length; li++) {
      const l = ch.lessons[li];
      if (l.id === lessonId) {
        return {
          moduleSlug: mod.id,
          moduleTitle: mod.title,
          moduleLanguage: mod.language,
          modulePosition: 1,
          chapterSlug: ch.id,
          chapterTitle: ch.title,
          chapterPosition: ci + 1,
          lessonPosition: li + 1,
          estimatedMinutes: l.estimatedMinutes,
        };
      }
    }
  }
  return null;
}

export async function publishLesson(
  draft: LessonDraft,
  skeleton: Skeleton,
  prisma: PrismaClient,
): Promise<PublishResult> {
  const ctx = findSkeletonContext(skeleton, draft.lessonId);
  if (!ctx) {
    throw new Error(
      `Lesson "${draft.lessonId}" not found in skeleton — run authoring:skeleton first`,
    );
  }

  const lessonType = LESSON_TYPE_MAP[draft.lessonType];
  if (!lessonType) {
    throw new Error(`Unknown lesson type: ${draft.lessonType}`);
  }

  const existing = await prisma.lesson.findUnique({
    where: { slug: draft.lessonId },
  });
  const created = !existing;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Upsert module
    const dbModule = await tx.module.upsert({
      where: { slug: ctx.moduleSlug },
      update: { title: ctx.moduleTitle },
      create: {
        slug: ctx.moduleSlug,
        title: ctx.moduleTitle,
        language: ctx.moduleLanguage,
        position: ctx.modulePosition,
      },
    });

    // 2. Upsert chapter
    const dbChapter = await tx.chapter.upsert({
      where: { slug: ctx.chapterSlug },
      update: { title: ctx.chapterTitle },
      create: {
        slug: ctx.chapterSlug,
        moduleId: dbModule.id,
        title: ctx.chapterTitle,
        position: ctx.chapterPosition,
      },
    });

    // 3. Upsert lesson
    const dbLesson = await tx.lesson.upsert({
      where: { slug: draft.lessonId },
      update: {
        title: draft.title,
        type: lessonType,
        estimatedMinutes: ctx.estimatedMinutes,
        teach: normaliseTeach(draft.teach),
      },
      create: {
        slug: draft.lessonId,
        chapterId: dbChapter.id,
        title: draft.title,
        type: lessonType,
        position: ctx.lessonPosition,
        estimatedMinutes: ctx.estimatedMinutes,
        teach: normaliseTeach(draft.teach),
      },
    });

    // 4. Replace LessonItem rows (delete + re-create for idempotency)
    await tx.lessonItem.deleteMany({ where: { lessonId: dbLesson.id } });
    await tx.lessonItem.createMany({
      data: draft.targetItemIds.map((itemId, i) => ({
        lessonId: dbLesson.id,
        itemId,
        role: 'TARGET' as const,
        position: i,
      })),
    });

    // 5. Replace Check rows
    await tx.check.deleteMany({ where: { lessonId: dbLesson.id } });
    await tx.check.createMany({
      data: draft.check.questions.map((q, i) => {
        const format = CHECK_FORMAT_MAP[q.answerType];
        if (!format) throw new Error(`Unknown check format: ${q.answerType}`);
        return {
          lessonId: dbLesson.id,
          position: i,
          prompt: q.prompt,
          format,
          targetItemId: q.targetItemId,
          data: {
            choices: q.choices ?? [],
            answer: q.correctAnswer,
            ...(q.explanation ? { explanation: q.explanation } : {}),
          },
        };
      }),
    });

    return { lessonDbId: dbLesson.id };
  });

  return {
    lessonSlug: draft.lessonId,
    lessonDbId: result.lessonDbId,
    created,
    itemsLinked: draft.targetItemIds.length,
    checksWritten: draft.check.questions.length,
  };
}
