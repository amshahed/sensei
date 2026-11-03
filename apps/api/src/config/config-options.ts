import type { ConfigModuleOptions } from '@nestjs/config';

/**
 * Options for the global ConfigModule. Under Jest (which sets NODE_ENV=test)
 * apps/api/.env is NOT loaded: a developer's real keys would otherwise switch
 * the AuthGuard to Clerk mode (every request 401s) and make grading, Voyage
 * and — once added — Azure/R2 clients call real, billed services from tests.
 * Ignoring the file covers every key and every suite (unit, integration, e2e);
 * variables exported by the shell or CI still apply, deliberately.
 */
export function configModuleOptions(
  env: NodeJS.ProcessEnv = process.env,
): ConfigModuleOptions {
  return { isGlobal: true, ignoreEnvFile: env.NODE_ENV === 'test' };
}
