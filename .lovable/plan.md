

## Plan: Speed Up My Group Activity Logging & Scheduling

### Problem
When you open a recruit detail, log an activity, or schedule a follow-up, the app feels slow or hangs because:

1. **Edge function cold starts**: The `fetch-assignable-users` function boots fresh each time (~30-50ms boot + network round trip + complex upline chain logic). Multiple components call it independently.
2. **Aggressive polling**: The recruit detail drawer polls for live data every 1 second, creating constant network chatter.
3. **Cascade refetches**: After logging an activity, the entire `group-recruits` dataset is invalidated and refetched, which is a heavy query.

### Changes

**1. Cache assignable users more aggressively**
- In `src/hooks/useAssignableUsers.ts`: Increase `staleTime` from 5 minutes to 15 minutes and add `gcTime` of 30 minutes. The upline chain rarely changes mid-session.
- This means the edge function is only called once per recruit, not every time a drawer opens.

**2. Reduce live polling frequency in RecruitDetailDrawer**
- In `src/components/mygroup/recruit-detail/RecruitDetailDrawer.tsx`: Change `refetchInterval` from `1000` (every second) to `5000` (every 5 seconds). Realtime subscriptions already handle instant updates for most changes — the polling is just a safety net.

**3. Skip redundant group-recruits invalidation after activity logging**
- In `src/hooks/useGroupRecruits.ts` (`useLogRecruitActivity.onSettled`): The optimistic update in `onMutate` already updates the cache. Remove the `invalidateQueries({ queryKey: ['group-recruits'] })` call and instead only invalidate the specific recruit's activities query. The realtime subscription will handle syncing the full dataset.

**4. Add loading timeout to ScheduleFollowUpDrawer and PostContactDrawer**
- Apply the same 8-second safety timeout pattern used on other pages. If the assignable users fetch hangs, render the form without the assignee picker rather than showing a perpetual loader.

### Technical Details

| File | Change |
|---|---|
| `src/hooks/useAssignableUsers.ts` | `staleTime: 15 * 60 * 1000`, add `gcTime: 30 * 60 * 1000` |
| `src/components/mygroup/recruit-detail/RecruitDetailDrawer.tsx` | `refetchInterval: 5000` (was `1000`) |
| `src/hooks/useGroupRecruits.ts` (useLogRecruitActivity) | Remove `invalidateQueries(['group-recruits'])` from `onSettled`, keep only recruit-specific invalidation |
| `src/components/mygroup/ScheduleFollowUpDrawer.tsx` | Show form immediately even if assignable users are still loading |
| `src/components/mygroup/PostContactDrawer.tsx` | Same — don't block form render on assignable users |

