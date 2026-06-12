import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { CheckResultDto } from '@sensei/types';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from '../mastery/mastery.service';

/**
 * Normalises an answer for comparison: trims, collapses internal whitespace and
 * lowercases. Deliberately conservative for the tracer bullet — kana/kanji are
 * compared as-is (no romaji folding). Fuzzy/AI grading arrives in issue #8.
 */
function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

@Injectable()
export class ChecksService {
  private readonly logger = new Logger(ChecksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
  ) {}

  /**
   * Grades a single Check answer by exact (normalised) match against the stored
   * answer, then writes the result back into the learner's FSRS schedule +
   * mastery (G.3, via MasteryService). The correct answer is revealed only in
   * the response, never on the lesson payload (see CheckDto), so the client
   * can't peek ahead.
   */
  async grade(
    checkId: string,
    answer: string,
    userId: string,
  ): Promise<CheckResultDto> {
    const check = await this.prisma.check.findUnique({
      where: { id: checkId },
    });

    if (!check) {
      throw new NotFoundException(`Check not found: ${checkId}`);
    }

    const data = (check.data ?? {}) as { answer?: unknown };
    const correctAnswer = typeof data.answer === 'string' ? data.answer : '';
    const correct = normalize(answer) === normalize(correctAnswer);

    // Mastery write-back must never block returning the grade to the learner.
    try {
      await this.mastery.recordCheckResult({
        userId,
        itemId: check.targetItemId,
        format: check.format,
        correct,
      });
    } catch (err) {
      this.logger.error(
        `Mastery write-back failed for check ${checkId}: ${String(err)}`,
      );
    }

    return { checkId: check.id, correct, correctAnswer };
  }
}
