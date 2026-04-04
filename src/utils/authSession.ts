import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "./withTimeout";

const SESSION_READ_TIMEOUT_MS = 2500;
const SESSION_REFRESH_TIMEOUT_MS = 5000;

/**
 * Safely get the current session, with automatic refresh fallback.
 * 
 * PERF FIX: Unlike getUser() (always hits network), this reads from local cache first.
 * Unlike raw getSession() (can return null on cold start before Supabase restores from localStorage),
 * this falls back to refreshSession() if the cache is empty.
 * 
 * Use this in all queryFn / mutationFn that need the current user.
 */
export const getSessionSafe = async () => {
  // 1. Try local session cache first
  try {
    const {
      data: { session },
    } = await withTimeout(
      supabase.auth.getSession(),
      SESSION_READ_TIMEOUT_MS,
      "Auth session check timed out"
    );

    if (session?.user) {
      return { session, user: session.user };
    }
  } catch (error) {
    console.warn("[authSession] getSession failed:", error);
  }

  // 2. Cache miss / stale native state — try a bounded refresh
  try {
    const { data: refreshData } = await withTimeout(
      supabase.auth.refreshSession(),
      SESSION_REFRESH_TIMEOUT_MS,
      "Auth session refresh timed out"
    );

    if (refreshData?.session?.user) {
      return { session: refreshData.session, user: refreshData.session.user };
    }
  } catch (error) {
    console.warn("[authSession] refreshSession failed:", error);
  }

  // 3. One final re-read in case native storage finished restoring late
  try {
    const {
      data: { session },
    } = await withTimeout(
      supabase.auth.getSession(),
      SESSION_READ_TIMEOUT_MS,
      "Auth session recheck timed out"
    );

    if (session?.user) {
      return { session, user: session.user };
    }
  } catch (error) {
    console.warn("[authSession] session recheck failed:", error);
  }

  // 4. No valid session
  return { session: null, user: null };
};
