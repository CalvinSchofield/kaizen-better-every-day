import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Native Token Storage Bridge
 * 
 * iOS can purge WebView localStorage under memory pressure, killing auth tokens.
 * Professional apps solve this by persisting tokens to native storage (UserDefaults on iOS)
 * which the OS never purges.
 *
 * This bridge:
 * 1. On app boot: restores tokens FROM native storage → localStorage (before Supabase reads them)
 * 2. On auth change: copies tokens FROM localStorage → native storage (backup)
 *
 * Since we can't modify the auto-generated Supabase client.ts, we work around it
 * by keeping localStorage in sync with a native-persistent copy.
 */

const SUPABASE_STORAGE_KEY_PREFIX = 'sb-';
const NATIVE_TOKEN_KEY = 'kaizen-supabase-auth-token';
const NATIVE_REFRESH_KEY = 'kaizen-supabase-refresh-token';

/**
 * Find the Supabase auth token key in localStorage.
 * Supabase stores it as `sb-{projectRef}-auth-token`.
 */
function findSupabaseAuthKey(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(SUPABASE_STORAGE_KEY_PREFIX) && key.endsWith('-auth-token')) {
        return key;
      }
    }
  } catch {
    // localStorage not available
  }
  return null;
}

/**
 * Restore auth tokens from native Preferences → localStorage.
 * Call this BEFORE the Supabase client reads from localStorage.
 * This is a synchronous-ish operation that must complete before React renders.
 */
export async function restoreNativeTokens(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { value: savedKey } = await Preferences.get({ key: 'kaizen-supabase-ls-key' });
    const { value: savedToken } = await Preferences.get({ key: NATIVE_TOKEN_KEY });

    if (!savedKey || !savedToken) {
      console.log('[NativeTokenStorage] No saved tokens to restore');
      return;
    }

    // Check if localStorage already has a valid token
    const existingToken = localStorage.getItem(savedKey);
    if (existingToken) {
      // localStorage is intact, no need to restore
      return;
    }

    // localStorage was purged — restore from native storage
    console.warn('[NativeTokenStorage] localStorage purged by iOS — restoring auth tokens from native storage');
    localStorage.setItem(savedKey, savedToken);
    console.log('[NativeTokenStorage] Auth tokens restored successfully');
  } catch (error) {
    console.warn('[NativeTokenStorage] Failed to restore tokens:', error);
  }
}

/**
 * Persist current auth tokens from localStorage → native Preferences.
 * Call this whenever auth state changes (sign in, token refresh, etc.)
 */
export async function persistTokensToNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const key = findSupabaseAuthKey();
    if (!key) return;

    const token = localStorage.getItem(key);
    if (!token) return;

    // Save both the key name and the token value to native storage
    await Preferences.set({ key: 'kaizen-supabase-ls-key', value: key });
    await Preferences.set({ key: NATIVE_TOKEN_KEY, value: token });
  } catch (error) {
    console.warn('[NativeTokenStorage] Failed to persist tokens:', error);
  }
}

/**
 * Clear native token storage (on explicit sign-out).
 */
export async function clearNativeTokens(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await Preferences.remove({ key: 'kaizen-supabase-ls-key' });
    await Preferences.remove({ key: NATIVE_TOKEN_KEY });
    await Preferences.remove({ key: NATIVE_REFRESH_KEY });
    console.log('[NativeTokenStorage] Native tokens cleared');
  } catch (error) {
    console.warn('[NativeTokenStorage] Failed to clear native tokens:', error);
  }
}
