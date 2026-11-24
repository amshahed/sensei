import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { AgeAnswer } from '@prisma/client';
import { IS_AGE_EXEMPT_KEY } from './age-exempt.decorator';
import type { AgeGateService } from './age-gate.service';
import { ADULTS_ONLY, AGE_NOT_CONFIRMED, AgeGuard } from './age.guard';
import { IS_PUBLIC_KEY } from './public.decorator';

function contextFor(userId?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ userId }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

/** A guard over a route with the given metadata and a stored answer. */
function guardWith(
  answer: AgeAnswer | null,
  meta: { isPublic?: boolean; isAgeExempt?: boolean } = {},
) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) =>
      key === IS_PUBLIC_KEY
        ? meta.isPublic
        : key === IS_AGE_EXEMPT_KEY
          ? meta.isAgeExempt
          : undefined,
    ),
  } as unknown as Reflector;
  const answerFor = jest.fn().mockResolvedValue(answer);
  const ageGate = { answerFor } as unknown as AgeGateService;
  return { guard: new AgeGuard(reflector, ageGate), answerFor };
}

describe('AgeGuard (M.5.b)', () => {
  it('lets an adult through', async () => {
    const { guard, answerFor } = guardWith('ADULT');
    await expect(guard.canActivate(contextFor('user_adult'))).resolves.toBe(
      true,
    );
    expect(answerFor).toHaveBeenCalledWith('user_adult');
  });

  it('refuses an under-18 answer with the adults-only message', async () => {
    const { guard } = guardWith('UNDER_18');
    const refused = guard.canActivate(contextFor('user_minor'));
    await expect(refused).rejects.toBeInstanceOf(ForbiddenException);
    await expect(refused).rejects.toThrow(ADULTS_ONLY);
  });

  it('refuses an unanswered or missing row as not confirmed yet', async () => {
    // answerFor() reads both a null column and a missing row as null.
    const { guard } = guardWith(null);
    const refused = guard.canActivate(contextFor('user_new'));
    await expect(refused).rejects.toBeInstanceOf(ForbiddenException);
    await expect(refused).rejects.toThrow(AGE_NOT_CONFIRMED);
  });

  it.each([
    ['@Public()', { isPublic: true }],
    ['@AgeExempt()', { isAgeExempt: true }],
  ])('passes a %s route without a lookup', async (_name, meta) => {
    const { guard, answerFor } = guardWith(null, meta);
    await expect(guard.canActivate(contextFor())).resolves.toBe(true);
    expect(answerFor).not.toHaveBeenCalled();
  });

  it('401s a gated route with no user (AuthGuard did not run)', async () => {
    const { guard, answerFor } = guardWith('ADULT');
    await expect(guard.canActivate(contextFor())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(answerFor).not.toHaveBeenCalled();
  });
});
