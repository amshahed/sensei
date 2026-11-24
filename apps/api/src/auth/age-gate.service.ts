import { Injectable } from '@nestjs/common';
import type { AgeAnswer } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Reads an account's answer to the age question for {@link AgeGuard}. A
 * provider of its own so integration specs about other things can stand it in.
 */
@Injectable()
export class AgeGateService {
  constructor(private readonly prisma: PrismaService) {}

  /** The stored answer, or null when unanswered or the row doesn't exist yet. */
  async answerFor(userId: string): Promise<AgeAnswer | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { ageAnswer: true },
    });
    return user?.ageAnswer ?? null;
  }
}
