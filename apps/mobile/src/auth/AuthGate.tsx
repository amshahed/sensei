import { useEffect, useRef } from 'react';
import {
  ClerkLoaded,
  ClerkProvider,
  SignedIn,
  SignedOut,
  useAuth,
} from '@clerk/clerk-expo';
import { api, setAuthTokenProvider } from '../api';
import { clerkPublishableKey, isClerkEnabled, tokenCache } from './clerk';
import { AuthScreen } from './AuthScreen';

/**
 * Gates the app behind authentication (L.6).
 *
 * In dev-stub mode (no publishable key) it renders children directly — the
 * backend bypasses auth too, so the core loop works without Clerk. With Clerk
 * configured it shows the AuthScreen when signed out, and wires the session
 * token into the API client when signed in.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  if (!isClerkEnabled) {
    return <>{children}</>;
  }
  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <SignedIn>
          <AuthedApp>{children}</AuthedApp>
        </SignedIn>
        <SignedOut>
          <AuthScreen />
        </SignedOut>
      </ClerkLoaded>
    </ClerkProvider>
  );
}

/**
 * Registers the Clerk session token with the API client and materialises the
 * user row (`GET /me`) once, then renders the app. Only mounts under
 * `<SignedIn>`, so the session is guaranteed present.
 */
function AuthedApp({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const materialised = useRef(false);

  useEffect(() => {
    // Install the token provider FIRST so the /me request below is
    // authenticated — ordering matters since `/me` is the only call that
    // upserts the users row. A failure clears the flag so a later token
    // change retries instead of leaving the account unmaterialised.
    setAuthTokenProvider(() => getToken());
    if (!materialised.current) {
      materialised.current = true;
      void api.me().catch(() => {
        materialised.current = false;
      });
    }
    return () => setAuthTokenProvider(null);
  }, [getToken]);

  return <>{children}</>;
}
