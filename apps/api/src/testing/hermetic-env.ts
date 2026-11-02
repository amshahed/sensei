/**
 * Side-effect module — import it FIRST in any spec that boots AppModule.
 *
 * `ConfigModule.forRoot()` loads apps/api/.env into process.env as soon as
 * AppModule is imported, but never overwrites a key that already exists
 * (@nestjs/config `assignVariablesToProcess`). Pinning these keys to '' before
 * that import keeps the suite hermetic regardless of the developer's real keys:
 *
 *  - CLERK_*      → otherwise the global AuthGuard leaves dev-stub mode and
 *                   every request 401s.
 *  - GEMINI_/ANTHROPIC_/VOYAGE_API_KEY → otherwise grading would make real,
 *                   billed, nondeterministic LLM calls from tests.
 *  - DATABASE_URL → anything that bypassed the Prisma fake fails loudly
 *                   instead of writing to the live database.
 *
 * CI has no .env, so this only changes behaviour on machines that have one.
 */
export const HERMETIC_ENV_KEYS = [
  'CLERK_SECRET_KEY',
  'CLERK_JWT_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'VOYAGE_API_KEY',
  'DATABASE_URL',
] as const;

for (const key of HERMETIC_ENV_KEYS) {
  process.env[key] = '';
}
