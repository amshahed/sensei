import { z } from 'zod';

export const LessonTypeSchema = z.enum([
  'F-Kana',
  'F-Vocab',
  'F-Kanji',
  'F-Grammar',
  'I-Listening',
  'I-Reading',
  'I-Writing',
  'I-Speaking',
]);
export type LessonType = z.infer<typeof LessonTypeSchema>;

/** A sound the lesson shows on a card, with no item behind it (D.2.a). */
export const KanaCardSchema = z.object({
  char: z.string().min(1),
  romaji: z.string().min(1),
});
export type KanaCard = z.infer<typeof KanaCardSchema>;

export const LessonSchema = z.object({
  id: z.string().min(1),
  type: LessonTypeSchema,
  title: z.string().min(1),
  itemIds: z.array(z.string().min(1)).min(1),
  estimatedMinutes: z.number().int().min(3).max(15),
  /** Instruction to the drafter that the outline fixes (F.1.b). */
  authorNote: z.string().min(1).optional(),
  kanaCards: z.array(KanaCardSchema).min(1).optional(),
  /** Each target word needs a typed check with no rōmaji in its prompt (P2). */
  typedReading: z.boolean().optional(),
});
export type Lesson = z.infer<typeof LessonSchema>;

export const ChapterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  lessons: z.array(LessonSchema).min(1),
});
export type Chapter = z.infer<typeof ChapterSchema>;

export const ModuleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  language: z.string().min(1),
  chapters: z.array(ChapterSchema).min(1),
});
export type Module = z.infer<typeof ModuleSchema>;

/** Sounds that have no kana item of their own, and the lesson teaching them. */
export const SoundStageSchema = z.object({
  lessonId: z.string().min(1),
  label: z.string().min(1),
  chars: z.string().min(1).optional(),
  longVowels: z.literal(true).optional(),
});
export type SoundStage = z.infer<typeof SoundStageSchema>;

/** `Skeleton.model` of an outline compiled from the spec, with no model call. */
export const COMPILED_OUTLINE_MODEL = 'compiled-outline';

export const SkeletonSchema = z.object({
  module: ModuleSchema,
  generatedAt: z.string().datetime(),
  model: z.string().min(1),
  tokenUsage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
  }),
  /** Item id to what the learner sees. Only a compiled outline has these. */
  surfaces: z.record(z.string(), z.string()).optional(),
  soundStages: z.array(SoundStageSchema).optional(),
});
export type Skeleton = z.infer<typeof SkeletonSchema>;
