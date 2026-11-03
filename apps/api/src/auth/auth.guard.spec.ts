import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AuthGuard, type AuthedRequest } from './auth.guard';
import * as clerk from './clerk';
import { DEFAULT_DEV_USER_ID } from './dev-user';

jest.mock('./clerk');

const mockedClerk = clerk as jest.Mocked<typeof clerk>;

/** Build a minimal ExecutionContext wrapping a fake request with headers. */
function contextFor(
  headers: Record<string, string>,
): [ExecutionContext, AuthedRequest] {
  const req = {
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as AuthedRequest;
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
  return [ctx, req];
}

function guardWith(isPublic: boolean): AuthGuard {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(isPublic),
  } as unknown as Reflector;
  return new AuthGuard(reflector);
}

describe('AuthGuard', () => {
  afterEach(() => jest.clearAllMocks());

  it('lets public routes through without resolving a user', async () => {
    const guard = guardWith(true);
    const [ctx, req] = contextFor({});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.userId).toBeUndefined();
  });

  describe('dev-stub mode (Clerk disabled)', () => {
    beforeEach(() => mockedClerk.isClerkEnabled.mockReturnValue(false));

    it('attributes to the dev user when no header is set', async () => {
      const guard = guardWith(false);
      const [ctx, req] = contextFor({});
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(req.userId).toBe(DEFAULT_DEV_USER_ID);
      expect(mockedClerk.verifyClerkToken).not.toHaveBeenCalled();
    });

    it('honours the x-dev-user-id override header', async () => {
      const guard = guardWith(false);
      const [ctx, req] = contextFor({ 'x-dev-user-id': 'user_abc' });
      await guard.canActivate(ctx);
      expect(req.userId).toBe('user_abc');
    });
  });

  describe('Clerk mode (enabled)', () => {
    beforeEach(() => mockedClerk.isClerkEnabled.mockReturnValue(true));

    it('resolves the user id from a verified bearer token', async () => {
      mockedClerk.verifyClerkToken.mockResolvedValue('user_clerk_123');
      const guard = guardWith(false);
      const [ctx, req] = contextFor({ authorization: 'Bearer tok.123' });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(mockedClerk.verifyClerkToken).toHaveBeenCalledWith('tok.123');
      expect(req.userId).toBe('user_clerk_123');
    });

    it('rejects a request with no bearer token', async () => {
      const guard = guardWith(false);
      const [ctx] = contextFor({});
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a non-bearer authorization scheme', async () => {
      const guard = guardWith(false);
      const [ctx] = contextFor({ authorization: 'Basic abc' });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects when token verification fails', async () => {
      mockedClerk.verifyClerkToken.mockRejectedValue(new Error('expired'));
      const guard = guardWith(false);
      const [ctx] = contextFor({ authorization: 'Bearer bad' });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
