

# Fix Rookie Unlock Logic for Sold Reps

## Problem

Weston Smith is locked out of Track/Calendar despite having already tracked sales because the unlock logic doesn't account for reps in "Sold" stages.

**Current unlock conditions** (in `src/hooks/useRookieUnlockStatus.ts`):
1. Has attended a past blitz
2. Is currently on an active blitz  
3. Stage includes "shadow"

**Missing conditions**:
- Stage includes "sold" (covers "Sold 💲" and "Sold (5+) 💰")

---

## Solution

Update `useRookieUnlockStatus.ts` to also unlock rookies whose stage contains "sold".

---

## Technical Changes

### File: `src/hooks/useRookieUnlockStatus.ts`

#### 1. Rename and expand the stage check

**Current code (lines 30-33):**
```typescript
const hasCompletedShadow = useMemo(() => {
  const stage = repData?.stage?.toLowerCase() || '';
  return stage.includes('shadow');
}, [repData?.stage]);
```

**New code:**
```typescript
// Check if stage qualifies for unlock (shadow or sold)
const hasQualifyingStage = useMemo(() => {
  const stage = repData?.stage?.toLowerCase() || '';
  return stage.includes('shadow') || stage.includes('sold');
}, [repData?.stage]);
```

#### 2. Update the unlock calculation

**Current code (lines 62-66):**
```typescript
const hasAttendedOrOnBlitz = hasAttendedBlitz || isOnActiveBlitz;

// Ultimate unlock: blitz OR shadow ✅
const isUnlocked = hasAttendedOrOnBlitz || hasCompletedShadow;
```

**New code:**
```typescript
const hasAttendedOrOnBlitz = hasAttendedBlitz || isOnActiveBlitz;

// Ultimate unlock: blitz OR qualifying stage (shadow/sold)
const isUnlocked = hasAttendedOrOnBlitz || hasQualifyingStage;
```

#### 3. Update return values

**Current:**
```typescript
return {
  isRookie,
  hasAttendedBlitz,
  isOnActiveBlitz,
  hasAttendedOrOnBlitz,
  hasCompletedShadow,
  isUnlocked,
  isPreBlitzRookie,
};
```

**New:**
```typescript
return {
  isRookie,
  hasAttendedBlitz,
  isOnActiveBlitz,
  hasAttendedOrOnBlitz,
  hasCompletedShadow: hasQualifyingStage, // Keep name for backwards compatibility
  isUnlocked,
  isPreBlitzRookie,
};
```

#### 4. Update the pure function version

Apply the same changes to `checkRookieUnlockStatus()` function (lines 82-118):

```typescript
// Check if stage qualifies for unlock (shadow or sold)
const stage = repData?.stage?.toLowerCase() || '';
const hasQualifyingStage = stage.includes('shadow') || stage.includes('sold');

// ... blitz checking logic stays the same ...

const hasAttendedOrOnBlitz = hasAttendedBlitz || isOnActiveBlitz;
const isUnlocked = hasAttendedOrOnBlitz || hasQualifyingStage;
const isPreBlitzRookie = isRookie && !isUnlocked;

return {
  isRookie,
  hasAttendedBlitz,
  isOnActiveBlitz,
  hasAttendedOrOnBlitz,
  hasCompletedShadow: hasQualifyingStage,
  isUnlocked,
  isPreBlitzRookie,
};
```

---

## Unlock Logic Summary

A rookie gets **full access** to Track, Calendar, Insights if ANY of these are true:

| Condition | Example |
|-----------|---------|
| Past blitz attended | Blitz ended before today |
| Currently on active blitz | Today is within blitz dates |
| Stage contains "shadow" | "Shadow ✅" |
| Stage contains "sold" | "Sold 💲" or "Sold (5+) 💰" |

---

## Impact

- **Weston Smith**: Stage is "Sold 💲" → Now unlocked
- **Any rookie marked Sold or Sold (5+)**: Now unlocked
- **No changes** to existing shadow/blitz unlock logic

---

## Files Modified

| File | Change |
|------|--------|
| `src/hooks/useRookieUnlockStatus.ts` | Add "sold" stage check to unlock conditions |

