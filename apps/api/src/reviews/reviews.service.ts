import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DueReviewItemDto, ReviewResultDto } from '@sensei/types';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from '../mastery/mastery.service';
import { RecallGraderService } from '../recall/recall-grader.service';
import { recallQuestionFor } from '../recall/recall-question';

/** G.4 session cap — matches the ~5–10 min micro-session length. */
export const REVIEW_SESSION_CAP = 15;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
    private readonly recall: RecallGraderService,
  ) {}

  /** Due items for a user, lowest-retention-first, capped per G.4. */
  async due(userId: string): Promise<DueReviewItemDto[]> {
    const items = await this.mastery.getDue(userId);
    return items.slice(0, REVIEW_SESSION_CAP);
  }

  /**
   * Grade one review answer with the shared recall rules (same questions and
   * grading as Assessments and Practice), then write the result back into
   * FSRS + mastery (G.3 path, via MasteryService). Typed recall updates the
   * `recall` breadcrumb.
   */
  async grade(
    userId: string,
    itemId: string,
    answer: string,
  ): Promise<ReviewResultDto> {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException(`Item not found: ${itemId}`);
    }
    const question = recallQuestionFor(item);
    if (!question) {
      throw new BadRequestException(
        `Item ${itemId} can't be reviewed yet: it has no answer to check against.`,
      );
    }

    const graded = await this.recall.grade(question, answer);
    const base = {
      itemId,
      correct: graded.correct,
      correctAnswer: question.expected,
      scored: graded.scored,
      ...(graded.feedback ? { feedback: graded.feedback } : {}),
    };
    if (!graded.scored) {
      // AI grader down and its fallback said "wrong": show the answer and
      // move on, but don't record a miss that may not be one (same as
      // lesson Checks).
      const current = await this.prisma.itemMasteryState.findUnique({
        where: { userId_itemId: { userId, itemId } },
        select: { mastery: true },
      });
      return { ...base, mastery: current?.mastery ?? 0 };
    }

    const state = await this.mastery.recordCheckResult({
      userId,
      itemId,
      format: 'TYPED',
      correct: graded.correct,
      rating: graded.rating,
    });
    return { ...base, mastery: state.mastery };
  }
}
