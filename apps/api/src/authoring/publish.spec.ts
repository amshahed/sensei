import type { PrismaClient } from '@prisma/client';
import { compiledOutline } from '../testing/compiled-outline';
import type { LessonDraft } from './lesson-schema';
import { publishRefusals } from './publish';

const { skeleton, lessons } = compiledOutline();

/** Lesson 22 as the Lead repointed it: clean. */
function lesson22(targetItemId = 'ja:vocab:ありがとう'): LessonDraft {
  const lesson = lessons[21];
  return {
    lessonId: lesson.id,
    lessonType: lesson.type,
    title: lesson.title,
    targetItemIds: lesson.itemIds,
    teach: { blocks: [{ type: 'text', text: 'ありがとう' }] },
    practice: {
      templates: [{ targetItemId: lesson.itemIds[0], mode: 'recognition' }],
    },
    check: {
      questions: [
        {
          id: 'q3',
          targetItemId,
          prompt: 'Your friend hands you a gift. What do you say?',
          answerType: 'multiple-choice',
          choices: [
            'ありがとう',
            'すみません',
            'ごめんなさい',
            'どういたしまして',
          ],
          correctAnswer: 'ありがとう',
          explanation: 'ありがとう thanks a friend.',
        },
      ],
    },
    meta: {
      generatedAt: new Date().toISOString(),
      model: 'm',
      tokenUsage: { inputTokens: 0, outputTokens: 0 },
    },
  };
}

/** Every declared target is a real VOCAB row. */
const prisma = (draft: LessonDraft) =>
  ({
    item: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          draft.targetItemIds.map((id) => ({ id, type: 'VOCAB' })),
        ),
    },
  }) as unknown as PrismaClient;

describe('publishRefusals (F.2.h)', () => {
  it('names the check whose target the draft does not declare', async () => {
    const draft = lesson22('ja:vocab:ありがotou');
    expect(await publishRefusals(draft, skeleton, prisma(draft))).toEqual([
      'structure: check question "q3" references undeclared targetItemId "ja:vocab:ありがotou"',
    ]);
  });

  it('refuses a draft that breaks the course rules', async () => {
    const draft = lesson22();
    draft.teach.blocks = [{ type: 'text', text: '学校' }];
    const refusals = await publishRefusals(draft, skeleton, prisma(draft));
    expect(refusals.join()).toMatch(/uses kanji 学 outside a kanji lesson/);
  });

  it('returns none for a clean draft', async () => {
    const draft = lesson22();
    expect(await publishRefusals(draft, skeleton, prisma(draft))).toEqual([]);
  });
});
