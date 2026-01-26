

# Weekly Sync Check - Timing Update

## Overview
Update the Weekly Sync Check prompt to show **every morning** until the rep confirms their numbers, but **never during knocking hours** when reps are actively in the field.

---

## Current State

The existing logic in `src/components/catchup/WeeklySyncPrompt.tsx` (lines 44-52):
```typescript
const isPromptTime = (): boolean => {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  
  // Sunday after 5pm, or Monday before noon
  return (day === 0 && hour >= 17) || (day === 1 && hour < 12);
};
```

**Problems:**
1. Uses device local time, not the rep's stored timezone
2. Only shows Sunday evening/Monday morning
3. Doesn't account for knocking hours

---

## New Timing Logic

### Requirements
Show the prompt **outside of knocking hours** in the rep's local timezone:

| Day | Knocking Hours (BLOCKED) | Prompt Allowed |
|-----|--------------------------|----------------|
| Sunday | None | All day |
| Monday | 12 PM - 9 PM | Before noon OR after 9 PM |
| Tuesday | 12 PM - 9 PM | Before noon OR after 9 PM |
| Wednesday | 12 PM - 9 PM | Before noon OR after 9 PM |
| Thursday | 12 PM - 9 PM | Before noon OR after 9 PM |
| Friday | 12 PM - 9 PM | Before noon OR after 9 PM |
| Saturday | 9 AM - 9 PM | Before 9 AM OR after 9 PM |

---

## Technical Changes

### File: `src/components/catchup/WeeklySyncPrompt.tsx`

#### 1. Update Props Interface
Add timezone prop to the component:
```typescript
interface WeeklySyncPromptProps {
  seasonType: 'preseason' | 'summer';
  seasonStartDate: string;
  seasonEndDate: string;
  timezone?: string | null; // Rep's local timezone
}
```

#### 2. Create Timezone-Aware Prompt Time Check
Replace the simple `isPromptTime()` function with a timezone-aware version:

```typescript
import { getHourInRepTimezone } from '@/hooks/useKnockingState';

/**
 * Check if we should show the sync prompt based on rep's local time.
 * BLOCKED during knocking hours:
 * - Mon-Fri: 12 PM - 9 PM
 * - Saturday: 9 AM - 9 PM
 * ALLOWED all other times (mornings, evenings, Sunday)
 */
const isOutsideKnockingHours = (timezone: string | null | undefined): boolean => {
  const now = new Date();
  
  // Get day and hour in rep's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'America/Los_Angeles',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  const weekday = parts.find(p => p.type === 'weekday')?.value;
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  
  // Sunday - no knocking hours, always show
  if (weekday === 'Sun') return true;
  
  // Saturday - knocking hours 9 AM to 9 PM
  if (weekday === 'Sat') {
    return hour < 9 || hour >= 21; // Before 9 AM or 9 PM onward
  }
  
  // Mon-Fri - knocking hours noon (12) to 9 PM (21)
  return hour < 12 || hour >= 21; // Before noon or 9 PM onward
};
```

#### 3. Update Component to Accept Timezone
The component needs to receive timezone from the parent:
```typescript
export const WeeklySyncPrompt = ({ 
  seasonType, 
  seasonStartDate, 
  seasonEndDate,
  timezone 
}: WeeklySyncPromptProps) => {
  // ... existing code ...
  
  useEffect(() => {
    if (!userId || effectiveLoading || !effectiveData) return;
    
    // Show if: needs verification AND outside knocking hours AND not recently confirmed
    const shouldShow = 
      effectiveData.needsVerification && 
      isOutsideKnockingHours(timezone) && 
      shouldShowPrompt(userId, seasonType);
    
    if (shouldShow) {
      const timer = setTimeout(() => setOpen(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [userId, effectiveData, effectiveLoading, seasonType, timezone]);
  
  // ... rest of component
};
```

#### 4. Update SyncPromptTrigger
```typescript
export const SyncPromptTrigger = ({ 
  seasonType,
  seasonStartDate,
  seasonEndDate,
  timezone
}: WeeklySyncPromptProps) => {
  return (
    <WeeklySyncPrompt 
      seasonType={seasonType}
      seasonStartDate={seasonStartDate}
      seasonEndDate={seasonEndDate}
      timezone={timezone}
    />
  );
};
```

### File: `src/pages/Home.tsx`

Update the SyncPromptTrigger usage to pass timezone:
```typescript
// Around line 1854-1858
<SyncPromptTrigger 
  seasonType="preseason"
  seasonStartDate="2025-09-28"
  seasonEndDate="2026-04-11"
  timezone={repData?.timezone}
/>
```

---

## Logic Summary

```text
Rep opens app at any time
    |
    v
[Check 1] Needs verification? (7+ days since last check)
    |-- No --> Don't show
    |-- Yes --> Continue
    v
[Check 2] Outside knocking hours in rep's timezone?
    |-- No (currently knocking hours) --> Don't show
    |-- Yes --> Continue
    v
[Check 3] Not recently dismissed?
    |-- Recently dismissed --> Don't show
    |-- OK --> Show prompt
```

**Knocking Hours Summary (when prompt is HIDDEN):**
- Sunday: Never hidden
- Monday-Friday: 12 PM - 9 PM local time
- Saturday: 9 AM - 9 PM local time

**Best times for prompt (when it WILL show):**
- Sunday: Any time
- Monday-Friday: Morning (before noon) or evening (after 9 PM)
- Saturday: Early morning (before 9 AM) or evening (after 9 PM)

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/catchup/WeeklySyncPrompt.tsx` | Replace `isPromptTime()` with timezone-aware `isOutsideKnockingHours()`, add timezone prop |
| `src/pages/Home.tsx` | Pass `repData?.timezone` to SyncPromptTrigger |

