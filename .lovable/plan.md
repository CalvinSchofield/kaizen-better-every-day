

# Skip Knocking Days Step on Biweekly Syncs

## Problem
The sync flow currently asks "How many days have you worked?" on every biweekly sync, but this should only be asked during the **initial sync** (first-time catch-up). After that, the app tracks worked days automatically through daily entries, so asking again is redundant and confusing.

## Current Capabilities Confirmed
- Users **can** add sales to past dates via the Calendar day drawer ("Add Sale" button navigates to the log-sale page with a date parameter)
- Users **cannot** retroactively mark a past day as "worked" without logging some activity on it
- Knocking days accumulate naturally from daily_entries after initial setup

## Changes

### 1. Skip `knocking_days` step on biweekly (non-initial) syncs

**File: `src/components/catchup/BiweeklySyncGate.tsx`**

Update the `shouldSkipStep` function to also skip `knocking_days` when `isInitialSync` is false:

```typescript
const shouldSkipStep = (s: SyncStep): boolean => {
  if (hasNoLoggedCustomers && (s === 'source' || s === 'crm')) return true;
  // Only ask about knocking days on the initial sync (catch-up baseline)
  if (!isInitialSync && s === 'knocking_days') return true;
  return false;
};
```

### 2. Use tracked knocking days automatically for biweekly syncs

When submitting a biweekly sync (non-initial), automatically use the tracked knocking days value instead of requiring user input:

```typescript
// In handleSubmit, for non-initial syncs, always use tracked days
const finalKnockingDays = isInitialSync 
  ? (knockingChoice === 'tracked' ? trackedKnockingDays 
     : knockingChoice === 'manual' ? (parseInt(knockingManual) || 0)
     : knockingChoice === 'unknown' ? null : 0)
  : trackedKnockingDays; // biweekly: always use tracked
```

## Impact
- Initial sync: still asks about knocking days (3 options: tracked, manual, "I'm not sure")
- Biweekly sync: skips the step entirely, uses tracked days automatically
- Step numbering and progress dots adjust dynamically (already handled by the existing `activeSteps` logic)
- No database changes needed

