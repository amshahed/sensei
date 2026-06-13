import { DEV_USER_ID, resolveDevUserId } from './dev-user';

describe('resolveDevUserId', () => {
  it('uses a non-empty header value', () => {
    expect(resolveDevUserId('user_abc')).toBe('user_abc');
  });

  it('trims surrounding whitespace', () => {
    expect(resolveDevUserId('  user_abc  ')).toBe('user_abc');
  });

  it('falls back to the dev user for missing / blank headers', () => {
    expect(resolveDevUserId(undefined)).toBe(DEV_USER_ID);
    expect(resolveDevUserId('')).toBe(DEV_USER_ID);
    expect(resolveDevUserId('   ')).toBe(DEV_USER_ID);
  });
});
