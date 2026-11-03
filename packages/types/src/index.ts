/**
 * Shared types consumed by both the API and the mobile client.
 * Kept framework-agnostic (no runtime code) so either side can import freely.
 */

export interface HealthResponse {
  status: "ok";
  service: string;
  timestamp: string;
}

/* ---- Auth / current user (issue #3 / decision L.6 — Clerk) ---- */

/**
 * The authenticated user, returned by `GET /me`. `id` is the Clerk user id
 * (the dev-user id in dev-stub mode). The row is created on first authenticated
 * request if it doesn't exist yet.
 */
export interface MeDto {
  id: string;
  /** ISO-8601 timestamp of when the user row was first created. */
  createdAt: string;
}

/* ---------------------------------------------------------------------------
 * Curriculum / lesson DTOs (mirror the Prisma schema; kept Prisma-free here so
 * both the API and the mobile client can share them). See decisions D.1, D.2,
 * B.2, B.3, B.4.
 * ------------------------------------------------------------------------- */

export type ItemType = "KANA" | "VOCAB" | "KANJI" | "GRAMMAR";

export type LessonType =
  | "F_KANA"
  | "F_VOCAB"
  | "F_KANJI"
  | "F_GRAMMAR"
  | "I_LISTENING"
  | "I_SPEAKING"
  | "I_READING"
  | "I_WRITING"
  | "I_SCENARIO"
  | "REVIEW"
  | "ASSESSMENT";

export type CheckFormat = "MULTIPLE_CHOICE" | "TYPED" | "SPOKEN";

export type LessonItemRole = "TARGET" | "SUPPORTING";

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
  /**
   * Optional "I guessed" self-report (K.1). Only meaningful on recognition /
   * multiple-choice checks: when set AND the answer is correct, the FSRS rating
   * is downgraded (Good → Hard). Never inflates; ignored on other formats.
   */
  guessed?: boolean;
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
export type Modality = "recognition" | "recall" | "production";

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

/**
 * One item surfaced in the due-review queue (G.4 selection). Carries no
 * reading / meaning: either can be the expected answer, which is revealed
 * only in the grading response.
 */
export interface DueReviewItemDto {
  itemId: string;
  type: ItemType;
  display: string;
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

/* ---- Progress Dashboard (issue #16 / decisions J.2.a–J.2.c) ---- */

export interface ProgressByTypeDto {
  type: ItemType;
  masteredCount: number;
  totalItems: number;
}

/**
 * Learner progress snapshot for the Dashboard (J.2). An item is "mastered"
 * when its mastery score ≥ 0.7 (stable in FSRS terms).
 */
export interface ProgressDto {
  aggregate: {
    /** Items with mastery ≥ 0.7. */
    masteredCount: number;
    /** Total items in the Foundation catalog. */
    totalItems: number;
    masteredPercent: number;
  };
  byType: ProgressByTypeDto[];
  modality: {
    /** Averages across all items the user has encountered (0–1). */
    recognition: number;
    recall: number;
    production: number;
  };
  recentRate: {
    /** Items reviewed in the last 7 days. */
    thisWeek: number;
    /** Items reviewed in the 7–14 day window before that. */
    lastWeek: number;
  };
}

export interface ReviewResultDto {
  itemId: string;
  correct: boolean;
  /** Revealed only in the grading response. */
  correctAnswer: string;
  /** 0–1 mastery after this review (unchanged when not scored). */
  mastery: number;
  /**
   * False when the answer couldn't be fairly judged (AI grader unavailable and
   * its word-for-word fallback said "wrong"): nothing was recorded.
   */
  scored: boolean;
  /** The AI grader's explanation, for meaning answers. */
  feedback?: string;
}

// ---------------- Curriculum Outline (#14, I.4.e) ----------------

/**
 * Chapter state (I.4.e). "Prerequisites met" uses next-chapter lookahead
 * (decisions.md I.4.e.a): the frontier — the first chapter not completed or
 * skipped — and the next unpassed chapter after it are reachable; everything
 * beyond is locked.
 */
export type ChapterState =
  | "completed"
  | "current"
  | "skipped_via_placement"
  | "available"
  | "locked";

/**
 * Lesson state within a chapter. `skipped` = its chapter was passed without it
 * (placement / Assessment), or a partial skip-test pass collapsed it (I.4.d.a).
 */
export type LessonState = "completed" | "current" | "not_started" | "skipped";

export interface CurriculumKeyItemDto {
  id: string;
  display: string;
  reading: string | null;
  meaning: string | null;
}

/** Read-only lesson row — the outline never navigates into a lesson (no mid-chapter jumping). */
export interface CurriculumLessonDto {
  id: string;
  slug: string;
  title: string;
  type: LessonType;
  position: number;
  estimatedMinutes: number | null;
  state: LessonState;
  /** The lesson's TARGET items, in teaching order. */
  keyItems: CurriculumKeyItemDto[];
}

export interface CurriculumChapterActionsDto {
  /** "Relocate position here": go back and learn a chapter that was skipped. */
  relocate: boolean;
  /**
   * The chapter Assessment can be taken (I.4.d.a): a skip-test on `current` /
   * `available` chapters, or the exit Assessment once the current chapter's
   * lessons are all done (`CurriculumDto.next.kind === 'assessment'`).
   */
  assessment: boolean;
  /** Review this chapter's items. */
  review: boolean;
}

export interface CurriculumChapterDto {
  id: string;
  slug: string;
  title: string;
  position: number;
  lessonCount: number;
  /** Sum of the lessons' estimatedMinutes (lessons without an estimate count 0). */
  estimatedMinutes: number;
  state: ChapterState;
  actions: CurriculumChapterActionsDto;
  lessons: CurriculumLessonDto[];
}

export interface CurriculumModuleDto {
  id: string;
  slug: string;
  title: string;
  position: number;
  chapters: CurriculumChapterDto[];
}

/** What "Continue" opens: the next lesson, or the chapter's exit Assessment. */
export type NextStepDto =
  | {
      kind: "lesson";
      slug: string;
      title: string;
      chapterId: string;
      chapterTitle: string;
      /**
       * Nothing in the chapter is done yet — the chapter-entry moment where
       * the skip-test is offered (I.4.d).
       */
      chapterStart: boolean;
    }
  | { kind: "assessment"; chapterId: string; chapterTitle: string };

/** `GET /curriculum/next` — just what Home's "Continue" needs. */
export interface CurriculumNextDto {
  /** Null when nothing is left. */
  next: NextStepDto | null;
}

export interface CurriculumDto extends CurriculumNextDto {
  modules: CurriculumModuleDto[];
  /** The chapter the learner is working in (null when everything is done). */
  currentChapterId: string | null;
  /**
   * True while the learner has relocated back to a skipped chapter; relocating
   * with `chapterId: null` returns them to their furthest point.
   */
  relocated: boolean;
}

export interface RelocateRequest {
  /** A skipped chapter to go back to, or null to return to the furthest point. */
  chapterId: string | null;
}

// ---------------- Chapter Assessment (I.4.d.a) ----------------

/** SKIP = taken before the chapter's lessons were all done; EXIT = after. */
export type AssessmentKind = "SKIP" | "EXIT";

export interface AssessmentQuestionDto {
  itemId: string;
  prompt: string;
}

/** `POST /chapters/:chapterId/assessment` — a fresh attempt (answers stay server-side). */
export interface AssessmentStartDto {
  attemptId: string;
  chapterId: string;
  chapterTitle: string;
  kind: AssessmentKind;
  /** Fraction correct needed to pass (0.8). */
  passThreshold: number;
  questions: AssessmentQuestionDto[];
  /**
   * The chapter's lessons are done and none of its items can be turned into a
   * question, so the exit Assessment passed without one (no questions).
   */
  autoPassed: boolean;
}

/** `POST /assessments/:attemptId/submit` — every answer at once (test-style). */
export interface AssessmentSubmitRequest {
  answers: { itemId: string; answer: string }[];
}

export interface AssessmentItemResultDto {
  itemId: string;
  prompt: string;
  answer: string;
  correct: boolean;
  correctAnswer: string;
}

export interface AssessmentResultDto {
  attemptId: string;
  chapterId: string;
  kind: AssessmentKind;
  passed: boolean;
  correct: number;
  total: number;
  passThreshold: number;
  results: AssessmentItemResultDto[];
  /** Lessons a failed skip-test collapsed (every key item tested + correct). */
  skippedLessonIds: string[];
}
