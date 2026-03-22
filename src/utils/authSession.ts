import { supabase } from "@/integrations/supabase/client";

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
  // 1. Try local session cache (instant, no network)
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    return { session, user: session.user };
  }

  // 2. Cache miss (cold start or expired) — try refresh (single network call)
  const { data: refreshData } = await supabase.auth.refreshSession();
  if (refreshData?.session?.user) {
    return { session: refreshData.session, user: refreshData.session.user };
  }

  // 3. No valid session
  return { session: null, user: null };
};
