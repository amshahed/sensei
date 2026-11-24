import { Injectable } from '@nestjs/common';
import type { Grade } from 'ts-fsrs';
import { exactMatch } from '../common/normalize-answer';
import { GradingService, modelComment } from '../grading/grading.service';
import { ratingFromLabel } from '../mastery/fsrs';
import { WritingEvalService } from '../writing-eval/writing-eval.service';
import type { RecallQuestion } from './recall-question';

export interface RecallGrade {
  correct: boolean;
  /**
   * False when the answer couldn't be fairly judged: the AI grader was
   * unavailable and its word-for-word fallback said "wrong". Callers must not
   * score it or write it to FSRS — our outage isn't the learner's miss.
   */
  scored: boolean;
  /** AI rating for meaning answers; undefined → derive from `correct`. */
  rating?: Grade;
  /** The model's own comment (meaning answers), never a fallback line (B.2.g). */
  feedback?: string;
}

/**
 * The surface-independent part of a graded recall answer (Reviews, Practice):
 * the verdict, the revealed answer, whether it counts, and AI feedback.
 */
export function recallResult(
  itemId: string,
  question: RecallQuestion,
  graded: RecallGrade,
) {
  return {
    itemId,
    correct: graded.correct,
    correctAnswer: question.expected,
    scored: graded.scored,
    ...(graded.feedback ? { feedback: graded.feedback } : {}),
  };
}

/** Grades a typed answer to a {@link RecallQuestion} (one rule set for every surface). */
@Injectable()
export class RecallGraderService {
  constructor(
    private readonly grading: GradingService,
    private readonly writingEval: WritingEvalService,
  ) {}

  async grade(
    question: RecallQuestion,
    rawAnswer: string,
  ): Promise<RecallGrade> {
    const answer = rawAnswer.trim();
    if (!answer) return { correct: false, scored: true };
    switch (question.check) {
      case 'romaji':
        return {
          correct: question.accepted.some((a) => exactMatch(answer, a)),
          scored: true,
        };
      case 'reading':
        return {
          correct: question.accepted.some((a) =>
            this.writingEval.exactMatch(answer, a),
          ),
          scored: true,
        };
      case 'meaning': {
        const r = await this.grading.gradeOpen({
          prompt: question.prompt,
          answer,
          exemplar: question.expected,
        });
        const fallbackMiss = r.gradedBy === 'fallback' && !r.correct;
        // Only the model's own comment on what the learner wrote (B.2.g).
        const feedback = modelComment(r);
        return {
          correct: r.correct,
          scored: r.scored && !fallbackMiss,
          rating: ratingFromLabel(r.rating),
          ...(feedback ? { feedback } : {}),
        };
      }
    }
  }
}
