import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { DEV_USER_HEADER, DEV_USER_ID } from './dev-user';

/**
 * Resolves the acting user's id for a request.
 *
 * Issue #3 will replace the body of this with a real Clerk-verified identity.
 * For now it reads the `x-dev-user-id` header if present, otherwise falls back
 * to the single dev user — so controllers can already depend on the final shape
 * (`@CurrentUserId() userId: string`) and won't change when auth lands.
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.header(DEV_USER_HEADER);
    return header && header.trim().length > 0 ? header.trim() : DEV_USER_ID;
  },
);
