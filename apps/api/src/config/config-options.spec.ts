import { configModuleOptions } from './config-options';

describe('configModuleOptions', () => {
  it('does not load .env under Jest (NODE_ENV=test)', () => {
    expect(process.env.NODE_ENV).toBe('test'); // set by Jest
    expect(configModuleOptions()).toEqual({
      isGlobal: true,
      ignoreEnvFile: true,
    });
  });

  it('loads .env everywhere else', () => {
    for (const env of [
      { NODE_ENV: 'development' },
      { NODE_ENV: 'production' },
      {},
    ]) {
      expect(configModuleOptions(env).ignoreEnvFile).toBe(false);
    }
  });
});
