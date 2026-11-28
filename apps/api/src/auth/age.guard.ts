import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthedRequest } from './auth.guard';
import { IS_AGE_EXEMPT_KEY } from './age-exempt.decorator';
import { AgeGateService } from './age-gate.service';
import { IS_PUBLIC_KEY } from './public.decorator';

export const AGE_NOT_CONFIRMED = 'Age not confirmed yet.';
export const ADULTS_ONLY = "Sensei's beta is for adults for now.";

/**
 * Global guard, registered after {@link AuthGuard}, that keeps every route
 * closed to an account until it has said it is 18 or over (M.5, M.5.b). The
 * beta is adults-only while runtime grading uses Gemini, so deny-by-default:
 * a new route is gated unless it is explicitly `@AgeExempt()`.
 *
 * `@Public()` and `@AgeExempt()` routes pass without a lookup. Otherwise an
 * unanswered or missing row gets 403 "not confirmed", an under-18 answer 403
 * "adults only", and only `ADULT` passes.
 */
@Injectable()
export class AgeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly ageGate: AgeGateService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets) ||
      this.reflector.getAllAndOverride<boolean>(IS_AGE_EXEMPT_KEY, targets)
    ) {
      return true;
    }

    const { userId } = context.switchToHttp().getRequest<AuthedRequest>();
    if (!userId) {
      // AuthGuard runs first and always sets it on a non-public route.
      throw new UnauthorizedException();
    }

    const answer = await this.ageGate.answerFor(userId);
    if (answer === 'ADULT') return true;
    throw new ForbiddenException(
      answer === 'UNDER_18' ? ADULTS_ONLY : AGE_NOT_CONFIRMED,
    );
  }
}
