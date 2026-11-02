import { isClerkEnabled } from './clerk';

describe('isClerkEnabled', () => {
  const original = {
    secret: process.env.CLERK_SECRET_KEY,
    jwtKey: process.env.CLERK_JWT_KEY,
  };

  afterEach(() => {
    process.env.CLERK_SECRET_KEY = original.secret;
    process.env.CLERK_JWT_KEY = original.jwtKey;
  });

  it('is disabled (dev-stub) when neither credential is set', () => {
    delete process.env.CLERK_SECRET_KEY;
    delete process.env.CLERK_JWT_KEY;
    expect(isClerkEnabled()).toBe(false);
  });

  it('is enabled when only the secret key is set', () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    delete process.env.CLERK_JWT_KEY;
    expect(isClerkEnabled()).toBe(true);
  });

  it('is enabled when only the networkless JWT key is set', () => {
    // Regression: a networkless-only deploy must NOT silently bypass auth.
    delete process.env.CLERK_SECRET_KEY;
    process.env.CLERK_JWT_KEY = '-----BEGIN PUBLIC KEY-----';
    expect(isClerkEnabled()).toBe(true);
  });

  it('treats blank/whitespace credentials as unset', () => {
    process.env.CLERK_SECRET_KEY = '   ';
    process.env.CLERK_JWT_KEY = '';
    expect(isClerkEnabled()).toBe(false);
  });
});
