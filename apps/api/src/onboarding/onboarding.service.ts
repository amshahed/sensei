import { ConflictException, Injectable } from '@nestjs/common';
import type { IntakeRequest, OnboardingDto } from '@sensei/types';
import { placementTierFor } from '../placement/placement-questions';
import { PrismaService } from '../prisma/prisma.service';

export const DEFAULT_DAILY_TARGET = 10;

/**
 * Signup intake (I.3.b) and where the learner is in onboarding: survey, then
 * — if they've studied before — the placement quiz (I.3.d), then lessons.
 */
@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async status(userId: string): Promise<OnboardingDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        intakeCompletedAt: true,
        priorExperience: true,
        placementAttempt: { select: { status: true } },
      },
    });
    if (!user?.intakeCompletedAt) {
      return { intakeDone: false, placement: 'not_needed' };
    }
    if (!placementTierFor(user.priorExperience)) {
      return { intakeDone: true, placement: 'not_needed' };
    }
    const status = user.placementAttempt?.status;
    return {
      intakeDone: true,
      placement: !status || status === 'IN_PROGRESS' ? 'pending' : 'done',
    };
  }

  /** Store the 3-question survey once (it routes placement, so no re-takes). */
  async submitIntake(
    userId: string,
    req: IntakeRequest,
  ): Promise<OnboardingDto> {
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, intakeCompletedAt: null },
      data: {
        interests: [...new Set(req.interests)],
        priorExperience: req.priorExperience,
        dailyTargetMinutes: req.dailyTargetMinutes ?? DEFAULT_DAILY_TARGET,
        intakeCompletedAt: new Date(),
      },
    });
    if (count === 0) {
      throw new ConflictException('The signup survey was already submitted.');
    }
    return this.status(userId);
  }
}
