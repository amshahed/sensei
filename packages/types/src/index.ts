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
