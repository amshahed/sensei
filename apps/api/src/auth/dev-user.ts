/**
 * Development user stub. Real auth (Clerk) lands in issue #3; until then every
 * request is attributed to a single deterministic user so the core loop
 * (lesson → check → completion → mastery) can be built and tested end-to-end.
 */
export const DEV_USER_ID = process.env.DEV_USER_ID ?? 'dev-user';

/** Header a client may set to override the dev user (handy for local testing). */
export const DEV_USER_HEADER = 'x-dev-user-id';
