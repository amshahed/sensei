import * as fs from 'fs';
import * as path from 'path';
// Both .env loaders: Prisma Client (on require) and ConfigModule (via AppModule).
import '@prisma/client';
import { AppModule } from '../app.module';

const ENV_FILE = path.resolve(__dirname, '../../.env');

/** Minimal KEY=value reader (comments, blank lines, optional quotes). */
function readEnvFile(file: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of fs.readFileSync(file, 'utf-8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(
      line,
    );
    if (m) vars[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return vars;
}

describe('test runs ignore apps/api/.env', () => {
  // Vacuous on CI (no .env); on a developer machine with real keys it is the
  // regression guard for 401s / billed API calls from tests.
  const fileVars = fs.existsSync(ENV_FILE) ? readEnvFile(ENV_FILE) : {};

  it('no value from .env reaches process.env, even after Prisma + AppModule load', () => {
    void AppModule;
    const leaked = Object.entries(fileVars)
      .filter(([key, value]) => value !== '' && process.env[key] === value)
      .map(([key]) => key);
    expect(leaked).toEqual([]);
  });
});
