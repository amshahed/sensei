import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type Card,
  type Grade,
} from 'ts-fsrs';
import type { CheckFormat } from '@sensei/types';
import type { Modality } from '@sensei/types';

/**
 * Shared FSRS scheduler (G.2). Fuzz is disabled so scheduling is deterministic
 * — important for reproducible tests and so two learners with identical history
 * get identical due dates. Default parameters are fine at MVP; FSRS calibrates
 * per-learner automatically once review history accumulates (decisions G.2).
 */
// `enable_short_term: false` — new items graduate straight to multi-day
// intervals instead of FSRS's default minutes-out learning steps. Within-lesson
// reinforcement is handled by the lesson's own Check beats and Practice mode
// (J.1); the Reviews surface is the cross-session forgetting-curve tool (G.4),
// so it must not flood with items the learner just saw minutes ago.
export const scheduler = fsrs(
  generatorParameters({ enable_fuzz: false, enable_short_term: false }),
);

/**
 * Deterministic Check result → FSRS rating. Until AI grading (#8) supplies the
 * full Again/Hard/Good/Easy precision (G.3), a correct answer maps to Good and
 * an incorrect one to Again.
 */
export function ratingFromCorrect(correct: boolean): Grade {
  return correct ? Rating.Good : Rating.Again;
}

/** Map an AI grader's label (G.3, #8) to an FSRS rating. */
export function ratingFromLabel(
  label: 'Again' | 'Hard' | 'Good' | 'Easy',
): Grade {
  switch (label) {
    case 'Hard':
      return Rating.Hard;
    case 'Good':
      return Rating.Good;
    case 'Easy':
      return Rating.Easy;
    case 'Again':
      return Rating.Again;
    default:
      // Structured output constrains the label to the enum, but guard anyway:
      // an unexpected value must not become an `undefined` Grade downstream.
      return Rating.Again;
  }
}

/** Which modality a Check format exercises (G.1 breadcrumbs). */
export function modalityForFormat(format: CheckFormat): Modality {
  switch (format) {
    case 'MULTIPLE_CHOICE':
      return 'recognition';
    case 'TYPED':
      return 'recall';
    case 'SPOKEN':
      return 'production';
  }
}

const MASTERY_SCALE_DAYS = 30;

/**
 * Map FSRS stability (≈ days until retention decays to ~90%) to a 0–1 mastery
 * score. Saturating curve: more stable memory ⇒ higher mastery, approaching 1.
 * Unlike retrievability it does not decay merely with elapsed time, which makes
 * it the right primitive for the Apprentice→Burned display ladder (G.1).
 */
export function masteryFromStability(stability: number): number {
  if (stability <= 0) return 0;
  return 1 - Math.exp(-stability / MASTERY_SCALE_DAYS);
}

/** Rolling per-modality breadcrumb (EWMA toward the latest pass/fail). */
export function updateBreadcrumb(
  previous: number,
  correct: boolean,
  alpha = 0.4,
): number {
  return previous * (1 - alpha) + (correct ? 1 : 0) * alpha;
}

export function emptyCard(now: Date): Card {
  return createEmptyCard(now);
}

/**
 * Revive a card stored as JSON (Prisma `Json`) back into a live FSRS card —
 * the date fields come back as strings and must be Date objects for the
 * scheduler's day-math to work.
 */
export function reviveCard(stored: unknown): Card | null {
  if (!stored || typeof stored !== 'object') return null;
  const c = stored as Record<string, unknown>;
  if (typeof c.stability !== 'number' || typeof c.due !== 'string') return null;
  return {
    ...(c as unknown as Card),
    due: new Date(c.due),
    last_review: c.last_review ? new Date(c.last_review as string) : undefined,
  };
}

/** Serialize a card to a JSON-safe object for persistence. */
export function serializeCard(card: Card): Record<string, unknown> {
  return {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review
      ? new Date(card.last_review).toISOString()
      : null,
  };
}

/** Apply a rating, returning the next card state. */
export function applyRating(card: Card, rating: Grade, now: Date): Card {
  return scheduler.next(card, now, rating).card;
}

/** FSRS-predicted probability of recall at `at` (0–1). */
export function retrievability(card: Card, at: Date): number {
  return scheduler.get_retrievability(card, at, false);
}
