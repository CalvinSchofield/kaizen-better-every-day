
# Fix Planned Days Issues + Better Utilization

## Overview

Two related issues to address:
1. **Bug Fix**: Users can't remove past planned days that weren't worked
2. **Enhancement**: Planned days aren't being leveraged throughout the app experience

---

## Part 1: Fix Past Planned Day Removal

### Problem
Currently in `CalendarPlanningCard.tsx`, clicking on past dates is completely blocked, even for removing planned days that weren't worked.

### Solution
Allow users to **remove** (but not add) planned days from past dates that weren't worked.

### Technical Changes

**File: `src/components/goals/CalendarPlanningCard.tsx`**

Update `handleDayClick` function (around line 837):

```text
Current logic:
- Block ALL past date interactions

New logic:
- Allow past dates ONLY if:
  1. The date is currently planned
  2. The date was NOT worked
- This lets users clean up mistaken planned days
```

Update the button disabled state (around line 1121):
```text
Current: isPast is always disabled
New: isPast is disabled UNLESS (isPlanned AND NOT isWorked)
```

---

## Part 2: Leverage Planned Days Throughout App

### Current State
Planned days are only used for goal calculations. The app doesn't adapt its experience based on whether today is a work day.

### Opportunities for Improvement

#### 2A. Add "isTodayPlanned" to a shared context/hook

Create awareness of "is today a planned work day" throughout the app.

**New: `src/hooks/useTodayWorkStatus.ts`**
```typescript
// Combines planned days + current entry status
export const useTodayWorkStatus = () => {
  const { isDatePlanned } = usePlannedDays();
  const { entry } = useDailyEntry();
  
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isTodayPlanned = isDatePlanned(todayStr);
  const hasStartedWork = entry?.work_start_time !== null;
  const isWorkComplete = entry?.is_finalized === true;
  
  return {
    isTodayPlanned,
    hasStartedWork,
    isWorkComplete,
    isRestDay: !isTodayPlanned && !hasStartedWork,
  };
};
```

#### 2B. Enhance Knocking Mode Home

**File: `src/components/KnockingModeHome.tsx`**

Add contextual messaging based on work day status:
- If it's a planned day and user hasn't started: "Time to get started!"
- If it's NOT a planned day: "Enjoy your rest day" or show prep activities instead of tracking prompts

#### 2C. Smarter Knocking Mode Toggle Logic

**File: `src/hooks/useAppMode.ts`**

Consider planned days when determining knocking mode:
- If today is planned AND within summer dates → Auto-enable knocking mode
- If today is NOT planned → Could default to non-knocking mode (research/prep mode)

#### 2D. Rest Day UI Variant

Show different home experience on rest days:
- Instead of tracking prompts, show training content
- Show "prep for tomorrow" if tomorrow is planned
- Hide the "save your day" alerts

---

## Implementation Plan

### Phase 1: Fix the Bug (Critical)
1. Update `handleDayClick` in `CalendarPlanningCard.tsx` to allow removing past planned days that weren't worked
2. Update button disabled logic to match

### Phase 2: Add Work Status Hook
1. Create `useTodayWorkStatus` hook
2. Export from hooks index

### Phase 3: Enhance Home Experience  
1. Use work status in `KnockingModeHome` to show contextual UI
2. Add "rest day" variant with training/prep focus

### Phase 4: Consider Auto-Mode Logic
1. Evaluate adding planned-day awareness to `useAppMode`
2. Could auto-suggest knocking mode on planned days

---

## Technical Details

### CalendarPlanningCard.tsx Changes

**handleDayClick function (line ~837):**
```typescript
const handleDayClick = async (date: Date) => {
  const dayOfWeek = getDay(date);
  const userSummerEndDate = parseLocalDate(personalSummerEnd);
  const isPast = isBefore(date, today);
  const dateStr = format(date, 'yyyy-MM-dd');
  const isCurrentlyPlanned = isDatePlanned(dateStr);
  const isWorked = isDateWorked(dateStr);
  
  // Block Sundays and dates after summer end
  if (dayOfWeek === 0 || date > userSummerEndDate) return;
  
  // For past dates: only allow REMOVING planned days that weren't worked
  if (isPast) {
    if (isCurrentlyPlanned && !isWorked) {
      // Allow removal of past planned day
      await togglePlannedDay(dateStr);
    }
    // Block all other past date interactions
    return;
  }
  
  // ... rest of existing logic for future dates
};
```

**Button disabled state (line ~1121):**
```typescript
// New: Allow past planned days that weren't worked to be clickable
const canRemovePastPlanned = isPast && isPlanned && !isWorked;
const isDisabled = (isPast && !canRemovePastPlanned) || isSunday || isAfterPersonalSummerEnd;
```

### Files to Modify

| File | Change |
|------|--------|
| `src/components/goals/CalendarPlanningCard.tsx` | Allow removing past unworked planned days |
| `src/hooks/useTodayWorkStatus.ts` | New hook for work day awareness |
| `src/components/KnockingModeHome.tsx` | Contextual UI based on work day |

---

## Expected Outcome

1. **Bug Fixed**: Users can remove past planned days they didn't work
2. **Smarter UX**: App adapts based on whether it's a work day
3. **Rest Day Experience**: Different content shown on off-days (training focus)
4. **Better Planning**: Users understand the value of marking planned days
