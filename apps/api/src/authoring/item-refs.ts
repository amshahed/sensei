import { normalizeJapanese } from '../common/answer-romaji';
import type { CourseContext } from './course-context';
import { asGraded } from './course-rules';
import type { LessonDraft } from './lesson-schema';

/** A check moved from an item the draft doesn't declare to one it does. */
export interface Repoint {
  questionId: string;
  from: string;
  to: string;
}

const asAnswer = (s: string) => asGraded(normalizeJapanese(s));

/**
 * F.2.h: a check whose targetItemId the draft doesn't declare (lessons 22 and
 * 25: ja:vocab:ありがotou) is repointed when its correct answer, compared as
 * the grader compares it, is the surface of exactly one declared target. That
 * is the Lead's hand fix made mechanical, with no language judgment. With no
 * match, or more than one, the check is left for the validator to refuse.
 * Pure: the draft passed in is not changed.
 */
export function repointUndeclaredTargets(
  draft: LessonDraft,
  ctx: CourseContext,
): { draft: LessonDraft; repointed: Repoint[] } {
  const declared = new Set(draft.targetItemIds);
  const targets = ctx.targets.filter((t) => t.surface && declared.has(t.id));
  const repointed: Repoint[] = [];

  const questions = draft.check.questions.map((q) => {
    if (declared.has(q.targetItemId)) return q;
    const answer = asAnswer(q.correctAnswer);
    const named = targets.filter((t) => asAnswer(t.surface) === answer);
    if (named.length !== 1) return q;
    repointed.push({
      questionId: q.id,
      from: q.targetItemId,
      to: named[0].id,
    });
    return { ...q, targetItemId: named[0].id };
  });

  if (repointed.length === 0) return { draft, repointed };
  return {
    draft: { ...draft, check: { ...draft.check, questions } },
    repointed,
  };
}
