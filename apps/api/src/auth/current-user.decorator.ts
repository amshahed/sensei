import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthedRequest } from './auth.guard';

/**
 * Resolves the acting user's id for a request.
 *
 * The id is populated by the global {@link AuthGuard} (Clerk-verified in
 * production, dev-stub locally) as `req.userId`. Controllers depend only on the
 * final shape (`@CurrentUserId() userId: string`); the guard owns how it's
 * derived. If it's missing the guard didn't run — treat as unauthenticated.
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.userId) {
      throw new UnauthorizedException();
    }
    return req.userId;
  },
);
