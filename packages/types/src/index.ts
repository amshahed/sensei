/**
 * Shared types consumed by both the API and the mobile client.
 * Kept framework-agnostic (no runtime code) so either side can import freely.
 */

export interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

/* ---------------------------------------------------------------------------
 * Curriculum / lesson DTOs (mirror the Prisma schema; kept Prisma-free here so
 * both the API and the mobile client can share them). See decisions D.1, D.2,
 * B.2, B.3, B.4.
 * ------------------------------------------------------------------------- */

export type ItemType = 'KANA' | 'VOCAB' | 'KANJI' | 'GRAMMAR';

export type LessonType =
  | 'F_KANA'
  | 'F_VOCAB'
  | 'F_KANJI'
  | 'F_GRAMMAR'
  | 'I_LISTENING'
  | 'I_SPEAKING'
  | 'I_READING'
  | 'I_WRITING'
  | 'I_SCENARIO'
  | 'REVIEW'
  | 'ASSESSMENT';

export type CheckFormat = 'MULTIPLE_CHOICE' | 'TYPED' | 'SPOKEN';

export type LessonItemRole = 'TARGET' | 'SUPPORTING';

export interface ItemDto {
  /** Language-prefixed id, e.g. "ja:kana:a" (CC.1). */
  id: string;
  language: string;
  type: ItemType;
  /** Surface form, e.g. "あ", "猫". */
  display: string;
  reading: string | null;
  meaning: string | null;
}

export interface LessonItemDto extends ItemDto {
  role: LessonItemRole;
}

/**
 * A Check beat question. Note: the correct answer is intentionally NOT included
 * — grading happens server-side (issue #5) so the client cannot see the answer.
 */
export interface CheckDto {
  id: string;
  position: number;
  prompt: string;
  format: CheckFormat;
  targetItemId: string;
  /** Present for MULTIPLE_CHOICE checks. */
  choices?: string[];
}

export interface LessonDetailDto {
  id: string;
  slug: string;
  title: string;
  type: LessonType;
  estimatedMinutes: number | null;
  module: { id: string; title: string };
  chapter: { id: string; title: string };
  /** Authored Teach-beat content (block structure; rendered by the client). */
  teach: unknown;
  items: LessonItemDto[];
  checks: CheckDto[];
}

/* ---- Check grading + lesson completion (issue #5) ---- */

export interface CheckAnswerRequest {
  answer: string;
}

export interface CheckResultDto {
  checkId: string;
  correct: boolean;
  /** Revealed only after the learner has answered (the grading response). */
  correctAnswer: string;
  /** One line of tutor feedback — present for AI-graded open responses (#8). */
  feedback?: string;
}

export interface LessonCompletionDto {
  lessonId: string;
  completed: boolean;
  /** ISO-8601 timestamp. */
  completedAt: string;
}

/* ---- Mastery + spaced repetition (issue #6 / decisions G.1–G.4) ---- */

/** The three evaluation modalities tracked per item (G.1 breadcrumbs). */
export type Modality = 'recognition' | 'recall' | 'production';

/**
 * A learner's mastery snapshot for one item. `mastery` is the continuous 0–1
 * score (derived from FSRS stability); the per-modality fields are rolling
 * breadcrumbs (G.1). `retrievability` is the FSRS-predicted probability of
 * recall *right now*.
 */
export interface ItemMasteryDto {
  itemId: string;
  mastery: number;
  recognition: number;
  recall: number;
  production: number;
  retrievability: number;
  /** ISO-8601; when this item next falls due for review. */
  due: string | null;
}

/** One item surfaced in the due-review queue (G.4 selection). */
export interface DueReviewItemDto {
  itemId: string;
  type: ItemType;
  display: string;
  reading: string | null;
  meaning: string | null;
  mastery: number;
  /** FSRS-predicted probability of recall now; lower = more urgent. */
  retrievability: number;
  /** ISO-8601 due timestamp. */
  due: string;
  /** The modality with the lowest breadcrumb — what a review should target. */
  weakestModality: Modality;
  /** What the learner is asked to recall, e.g. "あ" → prompt to type its reading. */
  prompt: string;
}

/* ---- Review session (issue #7 / decisions G.4, B.3) ---- */

export interface ReviewAnswerRequest {
  answer: string;
}

export interface ReviewResultDto {
  itemId: string;
  correct: boolean;
  /** Revealed only in the grading response. */
  correctAnswer: string;
  /** Updated 0–1 mastery after this review. */
  mastery: number;
}
