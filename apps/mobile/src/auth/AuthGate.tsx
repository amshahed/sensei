import { useEffect } from 'react';
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
 * user row (`GET /me`) once on sign-in, then renders the app.
 */
function AuthedApp({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    setAuthTokenProvider(() => getToken());
    return () => setAuthTokenProvider(null);
  }, [getToken]);

  useEffect(() => {
    if (isSignedIn) {
      // Fire-and-forget: create/link the users row. Failures are non-fatal;
      // the next authenticated call will retry the upsert path anyway.
      void api.me().catch(() => undefined);
    }
  }, [isSignedIn]);

  return <>{children}</>;
}
