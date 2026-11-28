import { ConflictException, Injectable } from '@nestjs/common';
import type { AgeAnswer, IntakeRequest, OnboardingDto } from '@sensei/types';
import { placementTierFor } from '../placement/placement-questions';
import { learnerHasProgress } from '../placement/placement.service';
import { PrismaService } from '../prisma/prisma.service';

export const DEFAULT_DAILY_TARGET = 10;

/**
 * Where the learner is in onboarding: the age question (M.5.a), the signup
 * survey (I.3.b), then — if they've studied before — the placement quiz
 * (I.3.d), then lessons.
 */
@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async status(userId: string): Promise<OnboardingDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ageAnswer: true,
        intakeCompletedAt: true,
        priorExperience: true,
        placementAttempt: { select: { status: true } },
      },
    });
    const ageAnswer = user?.ageAnswer ?? null;
    if (!user?.intakeCompletedAt) {
      return { ageAnswer, intakeDone: false, placement: 'not_needed' };
    }
    if (!placementTierFor(user.priorExperience)) {
      return { ageAnswer, intakeDone: true, placement: 'not_needed' };
    }
    const status = user.placementAttempt?.status;
    if (status) {
      return {
        ageAnswer,
        intakeDone: true,
        placement: status === 'IN_PROGRESS' ? 'pending' : 'done',
      };
    }
    // Learners from before onboarding existed aren't placed on top of their
    // progress (placement belongs to signup, I.3.d).
    return {
      ageAnswer,
      intakeDone: true,
      placement: (await learnerHasProgress(this.prisma, userId))
        ? 'not_needed'
        : 'pending',
    };
  }

  /**
   * Store the answer to the age question once (M.5.a). The compare-and-set
   * never overwrites: a second answer, a retry or a second phone gets the
   * stored answer back, so an under-18 answer can't be flipped by re-posting.
   * A mis-tap reset is a team edit (age-confirmation tech.md 3.4).
   */
  async submitAge(userId: string, answer: AgeAnswer): Promise<OnboardingDto> {
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });
    await this.prisma.user.updateMany({
      where: { id: userId, ageAnswer: null },
      data: { ageAnswer: answer, ageAnsweredAt: new Date() },
    });
    return this.status(userId);
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
