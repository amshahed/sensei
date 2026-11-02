import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';
import { isClerkEnabled, verifyClerkToken } from './clerk';
import { DEV_USER_HEADER, resolveDevUserId } from './dev-user';

/** A request whose acting user has been resolved by the guard. */
export interface AuthedRequest extends Request {
  userId?: string;
}

/**
 * Global guard that resolves the acting user and attaches it as `req.userId`
 * for the `@CurrentUserId()` decorator to read.
 *
 * In Clerk mode it requires a valid `Authorization: Bearer <token>` session
 * JWT and rejects anything else with 401. In dev-stub mode (no CLERK_SECRET_KEY)
 * it trusts the `x-dev-user-id` header, falling back to the single dev user.
 * Routes marked `@Public()` are always allowed through without a user.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthedRequest>();

    if (!isClerkEnabled()) {
      // Dev-stub mode: no real auth, attribute to the dev user (or header).
      req.userId = resolveDevUserId(req.header(DEV_USER_HEADER));
      return true;
    }

    const token = extractBearerToken(req.header('authorization'));
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      req.userId = await verifyClerkToken(token);
    } catch {
      // Deliberately opaque: don't leak why verification failed to the client.
      throw new UnauthorizedException('Invalid session');
    }
    return true;
  }
}

/** Pull the token out of an `Authorization: Bearer <token>` header. */
function extractBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token?.trim()) {
    return null;
  }
  return token.trim();
}
