import { SetMetadata } from '@nestjs/common';

/** Metadata key marking a route as reachable before the age question (M.5.b). */
export const IS_AGE_EXEMPT_KEY = 'isAgeExempt';

/**
 * Marks a route as reachable by an account that hasn't confirmed it is 18 or
 * over, so the global AgeGuard skips it. Only for what the app calls before or
 * at the age question (`GET /me`, `GET /onboarding`, `POST /onboarding/age`);
 * nothing exempt may grade, teach or record progress.
 */
export const AgeExempt = () => SetMetadata(IS_AGE_EXEMPT_KEY, true);
