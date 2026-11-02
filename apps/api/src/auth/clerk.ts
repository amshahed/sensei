/**
 * Clerk configuration + token verification, isolated so the guard stays thin
 * and the "is Clerk even configured?" question has a single home.
 *
 * The backend runs in one of two modes:
 *   - **Clerk mode** (production / any env with CLERK_SECRET_KEY set): every
 *     request must carry a valid Clerk session JWT; `sub` is the user id.
 *   - **Dev-stub mode** (no CLERK_SECRET_KEY, e.g. local dev + CI): auth is
 *     bypassed and the acting user comes from the `x-dev-user-id` header
 *     (see dev-user.ts). This keeps the core loop runnable without provisioning
 *     Clerk, and lets CI stay green with no secrets.
 *
 * Flipping from dev-stub to Clerk is purely an env change — no code change.
 */
import { verifyToken } from '@clerk/backend';

/**
 * True when Clerk is configured and the guard should enforce real sessions.
 *
 * Either credential is sufficient: CLERK_SECRET_KEY (JWKS-fetch verification) or
 * CLERK_JWT_KEY (networkless verification). Keying off the secret key alone
 * would silently drop a networkless-only deployment into dev-stub mode with
 * auth fully bypassed — so both count.
 */
export function isClerkEnabled(): boolean {
  return Boolean(
    process.env.CLERK_SECRET_KEY?.trim() || process.env.CLERK_JWT_KEY?.trim(),
  );
}

/**
 * Verify a Clerk session token and return the authenticated user id (`sub`).
 *
 * Prefers networkless verification via CLERK_JWT_KEY (the PEM public key from
 * the Clerk dashboard) when present; otherwise falls back to CLERK_SECRET_KEY,
 * which lets `@clerk/backend` fetch the JWKS. CLERK_AUTHORIZED_PARTIES, when
 * set (comma-separated), is enforced against the token's `azp` claim.
 *
 * Throws if the token is missing, malformed, expired, or otherwise invalid.
 */
export async function verifyClerkToken(token: string): Promise<string> {
  const authorizedParties = process.env.CLERK_AUTHORIZED_PARTIES?.split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const payload = await verifyToken(token, {
    secretKey: process.env.CLERK_SECRET_KEY,
    jwtKey: process.env.CLERK_JWT_KEY,
    authorizedParties:
      authorizedParties && authorizedParties.length > 0
        ? authorizedParties
        : undefined,
  });

  if (!payload.sub) {
    throw new Error('Clerk token has no subject (sub) claim');
  }
  return payload.sub;
}
