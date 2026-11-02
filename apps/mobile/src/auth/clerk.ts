import * as SecureStore from 'expo-secure-store';
import type { TokenCache } from '@clerk/clerk-expo';

/**
 * Clerk publishable key for the Expo app. Public by design (ships in the client
 * bundle). When unset, the app runs in dev-stub mode — no auth gate, mirroring
 * the backend's dev-stub mode — so the core loop stays runnable without Clerk.
 */
export const clerkPublishableKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

/** Whether real Clerk auth is configured. */
export const isClerkEnabled = clerkPublishableKey.length > 0;

/**
 * Persists the Clerk session across app restarts in the device keychain /
 * keystore via expo-secure-store. SecureStore is unavailable on web, so fall
 * back to no caching there (Clerk keeps the session in memory for the session).
 */
export const tokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Best-effort: a keychain failure shouldn't crash the app.
    }
  },
};
