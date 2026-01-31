

# Fix Activity Flow: Gap Logic & FP Terminology

## Issues Identified

Based on your screenshot and the code analysis:

1. **Too Many Gaps Showing**: The demo data generates timestamps randomly throughout the day without correlation. A rep knocking 38 doors gets 20 random timestamps between 9 AM–8 PM, causing many 20+ minute gaps even during active work periods.

2. **Gaps Overlapping with Presentations**: The pink/salmon presentation zones and red gap zones are drawing at the same positions because the gap detection doesn't account for "in-home" zones where the rep is actually presenting.

3. **"Full Package" terminology**: Line 975 shows "Full Package Sale" - you want it to just say "FP" or "FP Sale".

---

## Technical Changes

### 1. Fix Gap Detection Logic
**File:** `src/components/reports/v2/RepDayActivityFlow.tsx`

The current logic (lines 407-445) simply checks time between consecutive events:
```typescript
// Only show gaps of 20+ minutes
if (gapMinutes < 20) continue;
```

**Problem:** It doesn't exclude time periods where the rep was *inside a home* (presentation zones). So a 40-minute presentation incorrectly also shows as a "40m gap".

**Fix:** Modify gap detection to exclude periods that overlap with `inHomeZones` or `extendedConversations`:

```typescript
// Check if this gap overlaps with an in-home zone
const overlapsWithHomeZone = inHomeZones.some(zone => {
  const zoneStartMs = zone.doorTime.getTime();
  const zoneEndMs = zone.endTime.getTime();
  // Gap overlaps if it's within a home zone
  return (gapStart >= zoneStartMs && gapStart < zoneEndMs) ||
         (gapEnd > zoneStartMs && gapEnd <= zoneEndMs) ||
         (gapStart <= zoneStartMs && gapEnd >= zoneEndMs);
});

if (overlapsWithHomeZone) continue; // Skip - rep was in a home
```

### 2. Fix Demo Data Timestamp Generation
**File:** `supabase/functions/seed-demo-data/index.ts`

The current `generateCounterTimestamps()` function (lines 184-217) creates random timestamps throughout the day with no correlation between events. This doesn't represent real activity patterns where a rep:
- Knocks → DM → Pitch → Transition → Presentation happens in sequence
- Has clusters of activity, not random scattering

**Fix:** Generate realistic "interaction clusters" where:
- Each cluster starts with a door knock
- DM, pitch, transition follow within seconds/minutes
- Presentations have 20-120 minute durations
- Time progresses forward through the day

### 3. Fix "Full Package" Terminology
**File:** `src/components/reports/v2/RepDayActivityFlow.tsx`

**Line 228-229:**
```typescript
// Before
label: sale.type === 'upgrade' ? 'Upgrade' : 'FP Sale',

// After
label: sale.type === 'upgrade' ? 'Upgrade' : 'FP',
```

**Line 591:**
```typescript
// Before
<span className="text-sm font-medium">{sale.label === 'Upgrade' ? 'Upgrade' : 'Full Package'}</span>

// After
<span className="text-sm font-medium">{sale.label === 'Upgrade' ? 'Upgrade' : 'FP'}</span>
```

**Line 974-976:**
```typescript
// Before
<div className="text-[10px] text-muted-foreground">
  {event.label === 'Upgrade' ? 'Upgrade Sale' : 'Full Package Sale'}
</div>

// After
<div className="text-[10px] text-muted-foreground">
  {event.label === 'Upgrade' ? 'Upgrade' : 'FP'}
</div>
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `RepDayActivityFlow.tsx` | Skip gaps that overlap with in-home zones; change "Full Package" → "FP" |
| `seed-demo-data/index.ts` | Generate sequential timestamp clusters instead of random scattering |

---

## Expected Result

After these fixes:
- **Gaps will only show for real inactivity** (20+ minutes with no in-home activity)
- **Presentations won't show gaps on top of them**
- **FP terminology** will be consistent throughout

The demo data will need to be regenerated after updating the seed function to see the improved activity flow visualization.

