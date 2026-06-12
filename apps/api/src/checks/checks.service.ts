import { Injectable, NotFoundException } from '@nestjs/common';
import type { CheckResultDto } from '@sensei/types';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Grades a single Check answer by exact (normalised) match against the stored
   * answer. The correct answer is revealed only in the response, never on the
   * lesson payload (see CheckDto), so the client can't peek ahead.
   */
  async grade(checkId: string, answer: string): Promise<CheckResultDto> {
    const check = await this.prisma.check.findUnique({
      where: { id: checkId },
    });

    if (!check) {
      throw new NotFoundException(`Check not found: ${checkId}`);
    }

    const data = (check.data ?? {}) as { answer?: unknown };
    const correctAnswer = typeof data.answer === 'string' ? data.answer : '';
    const correct = normalize(answer) === normalize(correctAnswer);

    return { checkId: check.id, correct, correctAnswer };
  }
}
