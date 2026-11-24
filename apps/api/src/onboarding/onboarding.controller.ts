import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import type {
  AgeAnswer,
  AgeAnswerRequest,
  IntakeRequest,
  Interest,
  OnboardingDto,
  PriorExperience,
} from '@sensei/types';
import { AgeExempt } from '../auth/age-exempt.decorator';
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

const AGE_ANSWERS: readonly AgeAnswer[] = ['ADULT', 'UNDER_18'];

export function isAgeAnswerRequest(body: unknown): body is AgeAnswerRequest {
  if (!body || typeof body !== 'object') return false;
  return AGE_ANSWERS.includes(
    (body as Record<string, unknown>).answer as AgeAnswer,
  );
}

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

/**
 * The age question (M.5.a), the signup survey (I.3.b) and onboarding progress.
 * `GET /onboarding` and `POST /onboarding/age` are what the app calls before
 * the age answer is known, so they are the only age-exempt routes here.
 */
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  /** What the app shows next: the age question, survey, placement or lessons. */
  @AgeExempt()
  @Get()
  status(@CurrentUserId() userId: string): Promise<OnboardingDto> {
    return this.onboarding.status(userId);
  }

  /**
   * Answer the age question once. A later answer, from a retry or another
   * device, changes nothing: the stored one comes back (M.5.a, P2 and P4).
   */
  @AgeExempt()
  @Post('age')
  age(
    @Body() body: unknown,
    @CurrentUserId() userId: string,
  ): Promise<OnboardingDto> {
    if (!isAgeAnswerRequest(body)) {
      throw new BadRequestException(
        `Body must be { "answer": ${AGE_ANSWERS.join(' | ')} }.`,
      );
    }
    return this.onboarding.submitAge(userId, body.answer);
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
