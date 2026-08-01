import { z } from 'zod';
import { LessonTypeSchema } from './skeleton-schema';

// ── Teach blocks ──────────────────────────────────────────────────────────────

export const TextBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string().min(1),
});
export const ExampleBlockSchema = z.object({
  type: z.literal('example'),
  japanese: z.string().min(1),
  reading: z.string().min(1),
  translation: z.string().min(1),
});
export const MnemonicBlockSchema = z.object({
  type: z.literal('mnemonic'),
  text: z.string().min(1),
});
export const AudioBlockSchema = z.object({
  type: z.literal('audio'),
  src: z.string().min(1),
  label: z.string().min(1),
});
export const PassageBlockSchema = z.object({
  type: z.literal('passage'),
  text: z.string().min(1),
  title: z.string().optional(),
});
/** Kana character card — used in F-Kana lesson Teach beats. */
export const KanaBlockSchema = z.object({
  type: z.literal('kana'),
  char: z.string().min(1),
  romaji: z.string().min(1),
  itemId: z.string().optional(),
  hint: z.string().optional(),
});
export const TeachBlockSchema = z.discriminatedUnion('type', [
  TextBlockSchema,
  ExampleBlockSchema,
  MnemonicBlockSchema,
  AudioBlockSchema,
  PassageBlockSchema,
  KanaBlockSchema,
]);
export type TeachBlock = z.infer<typeof TeachBlockSchema>;

// ── Practice ──────────────────────────────────────────────────────────────────

export const PracticeTemplateSchema = z.object({
  targetItemId: z.string().min(1),
  mode: z.enum(['recognition', 'recall', 'production']),
  hint: z.string().optional(),
});
export type PracticeTemplate = z.infer<typeof PracticeTemplateSchema>;

// ── Check ─────────────────────────────────────────────────────────────────────

export const CheckQuestionSchema = z.object({
  id: z.string().min(1),
  targetItemId: z.string().min(1),
  prompt: z.string().min(1),
  answerType: z.enum(['multiple-choice', 'typed', 'spoken']),
  choices: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1),
  explanation: z.string().optional(),
});
export type CheckQuestion = z.infer<typeof CheckQuestionSchema>;

// ── Lesson draft ──────────────────────────────────────────────────────────────

export const LessonDraftSchema = z.object({
  lessonId: z.string().min(1),
  lessonType: LessonTypeSchema,
  title: z.string().min(1),
  targetItemIds: z.array(z.string().min(1)).min(1),
  teach: z.object({ blocks: z.array(TeachBlockSchema).min(1) }),
  practice: z.object({ templates: z.array(PracticeTemplateSchema).min(1) }),
  check: z.object({ questions: z.array(CheckQuestionSchema).min(1) }),
  meta: z.object({
    generatedAt: z.string().datetime(),
    model: z.string().min(1),
    tokenUsage: z.object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
    }),
  }),
});
export type LessonDraft = z.infer<typeof LessonDraftSchema>;

// ── Critique ──────────────────────────────────────────────────────────────────

export const CRITIQUE_CHECKLIST = [
  'tone',
  'length',
  'flow',
  'example-feel',
  'audio',
  'lesson-type-adherence',
  'item-ref-match',
  'theme-tag-accuracy',
  'learner-confusion',
] as const;
export type CritiqueCheckName = (typeof CRITIQUE_CHECKLIST)[number];

export const ChecklistItemSchema = z.object({
  name: z.string().min(1),
  pass: z.boolean(),
  note: z.string().optional(),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const CritiqueSchema = z.object({
  lessonId: z.string().min(1),
  checks: z.array(ChecklistItemSchema).min(1),
  overallPass: z.boolean(),
  summary: z.string().optional(),
  meta: z.object({
    generatedAt: z.string().datetime(),
    model: z.string().min(1),
    tokenUsage: z.object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
    }),
  }),
});
export type Critique = z.infer<typeof CritiqueSchema>;

// ── Corrections log ──────────────────────────────────────────────────────────

export interface CorrectionEntry {
  lesson_type: string;
  original_draft: LessonDraft;
  notes: string;
  regenerated_version: LessonDraft | null;
  timestamp: string;
}
