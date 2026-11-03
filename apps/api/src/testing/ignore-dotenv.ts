/**
 * Jest `setupFiles` entry (unit + e2e configs): keep apps/api/.env out of every
 * test run.
 *
 * Two things load .env into process.env: ConfigModule.forRoot() (disabled under
 * test by configModuleOptions) and Prisma Client, which does it unconditionally
 * the first time @prisma/client is required, skipping keys that already exist.
 * So let Prisma do its one load here — the module stays cached for the test
 * file — then remove exactly the keys that load added. A developer's real keys
 * can then neither flip the AuthGuard to Clerk mode (every request 401s) nor
 * make LLM / Voyage / Azure / R2 clients call real, billed services. Covers
 * every key without a hand-kept list; variables exported by the shell or CI
 * predate the load and are left alone.
 */
const before = new Set(Object.keys(process.env));
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('@prisma/client');
for (const key of Object.keys(process.env)) {
  if (!before.has(key)) delete process.env[key];
}
