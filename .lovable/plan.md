

# TestFlight Reliability Audit & Fix Plan

## The Problems You're Seeing (and Why)

### 1. App Stuck Loading After Returning from Background (Critical)

**Root cause:** `refetchOnWindowFocus: false` in `App.tsx` line 65.

When the app comes back from the background, React Query does NOT refetch any data because this is explicitly disabled. The only resume handler is in `PushNotificationInitializer.tsx`, which invalidates just 5 query keys (leaderboard + daily-entry). Every other page/query stays frozen with stale or expired data.

Meanwhile, the Supabase auth token may have expired while backgrounded. When queries eventually try to run, they fail silently with 401s, but since `retry: 1` and no resume-triggered refetch, they just stay in error/stale state forever.

**Why force-closing works:** A fresh app launch triggers the full auth flow + `usePrefetchData` + all queries mount fresh.

### 2. Auth Token Expiry During Background (Critical)

Supabase access tokens expire after ~1 hour. If the app sits in the background for 1+ hours, on resume:
- `getSession()` returns the cached (expired) token
- Queries using that token get 401 errors
- `autoRefreshToken` only fires on `visibilitychange` IF the Supabase client detects it — but in Capacitor's WKWebView, `visibilitychange` events are unreliable
- The Capacitor `App.addListener('resume')` in `PushNotificationInitializer` doesn't refresh the session first

### 3. `refetchOnMount: false` Prevents Page Navigation Refresh

Line 66: queries never refetch when navigating between pages. Combined with `refetchOnWindowFocus: false`, once data goes stale or errors out, there's no automatic recovery path.

### 4. Remaining `getUser()` Network Calls

`useCurrentUserId.ts` still calls `supabase.auth.getUser()` (line 64) which is a network request. On resume after background, this can be slow (1-4s) or fail entirely on flaky mobile connections.

### 5. Edge Function Timeouts on Mobile

`useTeamAccess`, blitz functions, and other edge function calls have no mobile-specific timeout handling. On cellular connections, these can hang for 10-15s.

---

## Fix Plan

### Step 1: Add Comprehensive App Resume Handler

Create a new hook `useAppResume` that:
- Listens to both Capacitor `App.addListener('resume')` AND `document.visibilitychange`
- On resume: (a) calls `supabase.auth.refreshSession()` to ensure a valid token, (b) invalidates ALL active queries so they refetch with fresh auth
- Replace the partial resume handler in `PushNotificationInitializer`

**Files:** New `src/hooks/useAppResume.ts`, modify `src/components/P