

# Fix: Initial Sync Gate + "Haven't Sold Yet" Opt-Out

## Problems Found

The biweekly sync gate has a critical gap: it only activates when `hasOfficialTotals === true`. This means **no user ever sees the sync gate until they've already done an initial sync** -- but there's no mandatory initial sync in the flow. The CatchUpWizard exists as a drawer that opens from the "!" indicator, but it's completely optional and easy to miss.

### Current Flow (Broken)
```text
1. Loading/auth
2. Goals access check (Ramp to Blitz gate)
3. GoalSetupWizard (if no goals saved)
4. BiweeklySyncGate (ONLY if hasOfficialTotals AND sync window open) -- NEVER fires for new users
5. Normal goals content (with optional "!" indicator for sync)
```

### What Each User Type Actually Experiences

| Scenario | What Happens | Problem |
|---|---|---|
| New rookie, no sales | Goals wizard -> goals page with all zeros | No way to say "I haven't sold yet" to opt out of sync |
| Rookie, knocked but not tracked | Goals wizard -> goals page with 0 FP+ | Pace is wrong, no prompt to enter real Vivint numbers |
| Rookie, tracked but inaccurate | Goals wizard -> goals page with wrong data | No verification against Vivint |
| Soph/vet, no sales yet | Goals wizard -> goals page with zeros | Same -- no opt-out |
| Soph/vet, sold a lot but not tracked | Goals wizard -> goals page showing 0 FP+ | Pace is catastrophically wrong |
| Soph/vet, tracked but inaccurate | Goals wizard -> goals page with wrong data | No initial verification |

## Solution: Two Changes

### Change 1: Add Initial Sync Gate (right after goals wizard)

After goals are saved but BEFORE showing goals content, add a **mandatory initial sync** that uses the same `BiweeklySyncGate` component. The gate condition on line 736 of `Goals.tsx` changes from:

```text
BEFORE: needsBiweeklySync && hasOfficialTotals
AFTER:  needsBiweeklySync || !hasOfficialTotals (when goals are set up)
```

This means:
- First time after goals setup: `hasOfficialTotals = false` -- gate fires as "initial sync"
- Every other Sunday after that: `needsBiweeklySync = true` -- gate fires as "biweekly sync"

The intro screen messaging should adapt:
- **Initial sync**: "Before we show your pace, let's sync with Vivint to make sure we're starting from the right place"
- **Biweekly sync**: "Time to sync your numbers" (current messaging)

### Change 2: Add "I haven't sold yet" Option

On the intro/landing screen of the sync gate, add a third path for users who genuinely have no sales:

- **"Let's go"** -- starts the 8-step flow (existing)
- **"I haven't sold yet"** -- creates an official_totals record with all zeros (fp_plus=0, fp_sold=0, prmr=0) and stamps `last_verified_at`, effectively saying "my baseline is zero, track everything going forward"

This option:
- Should be available to ALL user types (rookie, sophomore, vet) -- early-season vets may not have sold yet
- Only shows on the **initial sync** (not biweekly syncs, since by then they should have data)
- Sets `hasOfficialTotals = true` with zeros, so future biweekly syncs work correctly
- Knocking days should be set to 0 (not null) since if they haven't sold, they haven't knocked

## Technical Changes

### File: `src/pages/Goals.tsx` (line 736)

Update the gate condition:

```typescript
// Show sync gate if:
// 1. Initial setup needed (goals done but no official totals yet), OR
// 2. Biweekly sync window is open
const needsInitialSync = effectiveFPData && !effectiveFPData.hasOfficialTotals;
const needsBiweekly = effectiveFPData?.needsBiweeklySync && effectiveFPData?.hasOfficialTotals;

if (needsInitialSync || needsBiweekly) {
  return (
    <Layout>
      <BiweeklySyncGate
        seasonType="preseason"
        effectiveData={effectiveFPData}
        isInitialSync={!!needsInitialSync}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['effective-fp'] });
          queryClient.invalidateQueries({ queryKey: ['official-totals'] });
        }}
      />
    </Layout>
  );
}
```

### File: `src/components/catchup/BiweeklySyncGate.tsx`

1. Add `isInitialSync` prop to the interface
2. Update intro screen:
   - When `isInitialSync`: show "Let's sync with Vivint" messaging + "I haven't sold yet" button
   - When biweekly: show current "Time to sync your numbers" messaging (no "haven't sold" option)
3. "I haven't sold yet" handler: upserts official_totals with all zeros and calls `onComplete()`

### File: `src/hooks/useEffectiveFP.ts`

The `needsVerification` field already covers the `!hasOfficialTotals` case (line 189: `const needsVerification = !hasOfficialTotals || needsBiweeklySync`). No change needed here -- the issue was only in `Goals.tsx` using `needsBiweeklySync` instead of `needsVerification`.

## Edge Cases to Consider

1. **User completes goals wizard and immediately sees sync gate**: This is correct behavior. They need to establish a baseline. The flow should feel natural -- "Great, goals are set! Now let's make sure your starting numbers are right."

2. **User selects "I haven't sold yet" but actually has tracked sales in the app**: The tracked values (totalTrackedFp etc.) will still be non-zero. After saving zeros as official, the `effectiveFp` will be `0 + trackedSinceVerification` which equals their tracked totals. This is actually correct -- their "official baseline" is 0 and everything tracked is additive.

3. **Biweekly sync fires but user has 0 sales still**: The flow works fine -- they tap "Use tracked: 0.0 FP+" for each metric and proceed quickly.

4. **User does initial sync, then tracks for 2 weeks, then biweekly sync fires**: Works correctly. The biweekly sync shows their tracked values vs. what Vivint has.

5. **The `needsBiweeklySync` timing**: Currently checks `isSyncWeek` based on epoch. The initial sync has no timing restriction -- it fires immediately after goals are saved regardless of what week it is.

6. **Season type**: Currently hardcoded to `'preseason'`. This should probably be dynamic based on whether the user's personal summer has started, but that's a separate concern from this fix.

