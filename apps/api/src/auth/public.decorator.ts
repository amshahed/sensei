import { SetMetadata } from '@nestjs/common';

/** Metadata key marking a route as reachable without authentication. */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a controller or route handler as public, so the global AuthGuard skips
 * it. Used for unauthenticated endpoints like the health check.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
