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

export const LessonSchema = z.object({
  id: z.string().min(1),
  type: LessonTypeSchema,
  title: z.string().min(1),
  itemIds: z.array(z.string().min(1)).min(1),
  estimatedMinutes: z.number().int().min(3).max(15),
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

export const SkeletonSchema = z.object({
  module: ModuleSchema,
  generatedAt: z.string().datetime(),
  model: z.string().min(1),
  tokenUsage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
  }),
});
export type Skeleton = z.infer<typeof SkeletonSchema>;
