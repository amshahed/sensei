/**
 * Development user stub. Real auth (Clerk) lands in issue #3; until then every
 * request is attributed to a single deterministic user so the core loop
 * (lesson → check → completion → mastery) can be built and tested end-to-end.
 */
export const DEFAULT_DEV_USER_ID = 'dev-user';

/**
 * The dev-stub user: DEV_USER_ID if set, else 'dev-user'. Read on each call —
 * this module is imported before ConfigModule.forRoot() loads .env, so a
 * module-level constant silently ignored a DEV_USER_ID set in .env.
 */
export function devUserId(): string {
  return process.env.DEV_USER_ID?.trim() || DEFAULT_DEV_USER_ID;
}

/** Header a client may set to override the dev user (handy for local testing). */
export const DEV_USER_HEADER = 'x-dev-user-id';

/**
 * Resolve the acting user id from the dev-user header value, falling back to the
 * single dev user. Extracted from the param decorator so the rule is unit-
 * testable; issue #3 swaps the call site for a Clerk-verified identity.
 */
export function resolveDevUserId(headerValue: string | undefined): string {
  const trimmed = headerValue?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : devUserId();
}
