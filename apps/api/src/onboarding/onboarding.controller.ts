import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import type {
  IntakeRequest,
  Interest,
  OnboardingDto,
  PriorExperience,
} from '@sensei/types';
import { CurrentUserId } from '../auth/current-user.decorator';
import { DAILY_TARGETS, isDailyTarget } from '../streak/streak-rules';
import { OnboardingService } from './onboarding.service';

const INTERESTS: readonly Interest[] = [
  'TRAVEL',
  'ANIME_MANGA',
  'LIVE_WORK',
  'FRIENDS_FAMILY',
  'JLPT',
  'CURIOUS',
];
const PRIOR: readonly PriorExperience[] = [
  'NONE',
  'SOME_KANA',
  'FAIR_AMOUNT',
  'REFRESHER',
];

export function isIntakeRequest(body: unknown): body is IntakeRequest {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    Array.isArray(b.interests) &&
    b.interests.length > 0 &&
    b.interests.every((i) => INTERESTS.includes(i as Interest)) &&
    PRIOR.includes(b.priorExperience as PriorExperience) &&
    (b.dailyTargetMinutes === undefined || isDailyTarget(b.dailyTargetMinutes))
  );
}

/** Signup survey (I.3.b) + onboarding progress. */
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  /** What the app should show next: survey, placement, or lessons. */
  @Get()
  status(@CurrentUserId() userId: string): Promise<OnboardingDto> {
    return this.onboarding.status(userId);
  }

  @Post('intake')
  intake(
    @Body() body: unknown,
    @CurrentUserId() userId: string,
  ): Promise<OnboardingDto> {
    if (!isIntakeRequest(body)) {
      throw new BadRequestException(
        `Body must be { "interests": [one or more of ${INTERESTS.join(', ')}], "priorExperience": ${PRIOR.join(' | ')}, "dailyTargetMinutes"?: ${DAILY_TARGETS.join(' | ')} }.`,
      );
    }
    return this.onboarding.submitIntake(userId, {
      interests: body.interests,
      priorExperience: body.priorExperience,
      ...(body.dailyTargetMinutes
        ? { dailyTargetMinutes: body.dailyTargetMinutes }
        : {}),
    });
  }
}
