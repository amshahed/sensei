import { DEFAULT_DEV_USER_ID, devUserId, resolveDevUserId } from './dev-user';

describe('resolveDevUserId', () => {
  it('uses a non-empty header value', () => {
    expect(resolveDevUserId('user_abc')).toBe('user_abc');
  });

  it('trims surrounding whitespace', () => {
    expect(resolveDevUserId('  user_abc  ')).toBe('user_abc');
  });

  it('falls back to the dev user for missing / blank headers', () => {
    expect(resolveDevUserId(undefined)).toBe(DEFAULT_DEV_USER_ID);
    expect(resolveDevUserId('')).toBe(DEFAULT_DEV_USER_ID);
    expect(resolveDevUserId('   ')).toBe(DEFAULT_DEV_USER_ID);
  });
});

describe('devUserId', () => {
  const original = process.env.DEV_USER_ID;
  afterEach(() => {
    if (original === undefined) delete process.env.DEV_USER_ID;
    else process.env.DEV_USER_ID = original;
  });

  it('reads DEV_USER_ID at call time, so a value loaded from .env after import applies', () => {
    process.env.DEV_USER_ID = 'user_from_env';
    expect(devUserId()).toBe('user_from_env');
    expect(resolveDevUserId(undefined)).toBe('user_from_env');
  });

  it("falls back to 'dev-user' when unset or blank", () => {
    delete process.env.DEV_USER_ID;
    expect(devUserId()).toBe(DEFAULT_DEV_USER_ID);
    process.env.DEV_USER_ID = '  ';
    expect(devUserId()).toBe(DEFAULT_DEV_USER_ID);
  });
});
