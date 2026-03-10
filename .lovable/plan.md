# Unlock App for Rookies When Personal Summer Starts

## Problem

Rookies who haven't completed Ramp to Blitz are locked out of Track, Insights, Calendar, and other field tools. Once their personal summer date arrives, they should have full access regardless of ramp completion -- especially since the leader's ability to track ramp progress for them disappears once summer starts.

## Solution

Add `personal_summer_start` as an additional unlock condition in the centralized `useRookieUnlockStatus` hook. If today >= the rookie's personal summer start date, they're unlocked.

Since `repData` doesn't include summer dates, the hook needs to fetch from `season_config`. To keep it lightweight:

- Accept an optional `personalSummerStart` parameter (string or null)
- The calling components that already have this data can pass it in
- Also add a standalone check using the global fallback date for the pure function version

## Changes

### `src/hooks/useRookieUnlockStatus.ts`

- Add `personalSummerStart?: string | null` to the `RepDataForUnlock` interface
- Add a `hasSummerStarted` check: `today >= personalSummerStart`
- Include it in the `isUnlocked` condition: `hasAttendedOrOnBlitz || hasQualifyingStage || hasSummerStarted`
- Same for the pure `checkRookieUnlockStatus` function

### Callers that need to pass summer start data

The hook is used in ~10 files. Most already have access to `useAppMode` or `season_config` nearby. The key change: pass `personalSummerStart` from wherever it's available. For pages that don't have it, the hook will use the global fallback (`2026-04-12`) -- but since we're currently pre-summer, this won't incorrectly unlock anyone early.

**Files to update to pass summer start:**

- `src/pages/Track.tsx` -- already uses `useAppMode`, can get `seasonConfig.personal_summer_start`
- `src/pages/Home.tsx` -- already uses `useAppMode`
- `src/pages/Insights.tsx` -- add `useAppMode` or pass from existing data
- `src/pages/Calendar.tsx` -- already fetches season_config
- `src/pages/Customers.tsx` -- add season config access
- `src/components/Layout.tsx` -- nav bar lock logic
- `src/components/AppDrawer.tsx` -- drawer lock logic
- `src/components/leaderboard/ChallengesTab.tsx` and `IncentivesTab.tsx`

**Approach:** Rather than updating every caller, I'll make the hook self-sufficient by adding an internal `useQuery` for `season_config` that only fires when the user is a rookie who isn't already unlocked by other conditions. This way zero callers need changes.

## Technical Detail

```typescript
// Inside useRookieUnlockStatus, after checking blitz/stage:
const needsSummerCheck = isRookie && !hasAttendedOrOnBlitz && !hasQualifyingStage;

const { data: seasonConfig } = useQuery({
  queryKey: ['rookie-summer-check'],
  enabled: needsSummerCheck,
  staleTime: 5 * 60 * 1000,
  queryFn: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('season_config')
      .select('personal_summer_start')
      .eq('user_id', user.id)
      .maybeSingle();
    return data;
  },
});

const hasSummerStarted = useMemo(() => {
  if (!needsSummerCheck) return false;
  const start = seasonConfig?.personal_summer_start;
  if (!start) {
    // Fallback to global date
    return new Date() >= new Date('2026-04-12T00:00:00');
  }
  return new Date() >= new Date(start + 'T00:00:00');
}, [needsSummerCheck, seasonConfig]);

const isUnlocked = hasAttendedOrOnBlitz || hasQualifyingStage || hasSummerStarted;
```

The pure function `checkRookieUnlockStatus` will use the global fallback only (since it can't query async), which is acceptable for its usage contexts.

&nbsp;

&nbsp;

&nbsp;

STILL DONT GIVD REPS MARKED AS NOT INTERESRED or SIGNED BUT NOT INTERESTED or POTENTIAL FOLLOW UP access to ANSYTHIMG in the app remember