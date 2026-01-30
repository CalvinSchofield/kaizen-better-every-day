
# Add Total Spending Baseline Override

## Overview

Allow users to manually enter their total season spending amount to reconcile discrepancies between tracked deal spending and actual spending (buyouts, promos, free months, etc.).

---

## Solution Approach

### Option A: Add to `official_totals` table (Recommended)
Add a `total_spent` column to the existing `official_totals` table. This keeps all "official/verified" season baselines in one place (FP+, PRMR, knocking days, and now spending).

### How It Works
1. **Baseline Override**: User enters their TOTAL amount spent this season (from Source/buyouts)
2. **Calculation**: Earnings calculations use `max(tracked_spent, official_baseline)` or add difference
3. **Access Point**: Tap on the "Avg Cost / EFP" card on Insights page to open adjustment sheet

---

## UI/UX Design

### Entry Point 1: Tap the "Avg Cost / EFP" Card
The card shown in the screenshot (circled - "$34.95 Avg Cost / EFP") becomes tappable:
- Opens a drawer/sheet for adjusting total spending
- Similar pattern to tapping other cards in the app

### Entry Point 2: Earnings Breakdown Card
In the Goals page EarningsBreakdownCard, add a small "Adjust" link near the spending figures.

### Spending Override Sheet
```
┌─────────────────────────────────────────┐
│  Total Season Spending                  │
│                                         │
│  Your tracked spending: $1,875          │
│  (from 45 deals logged)                 │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Actual Total Spent             │    │
│  │  $ [_______2,340_______]        │    │
│  └─────────────────────────────────┘    │
│                                         │
│  🔗 Check buyouts on Source             │
│                                         │
│  ─────────────────────────────────────  │
│  Your adjusted totals:                  │
│  • Avg Cost/EFP: $37.24 → $40.21        │
│  • Net Upfront: $16,365 → $15,900       │
│                                         │
│         [ Save Adjustment ]             │
└─────────────────────────────────────────┘
```

### Key Features
1. **Shows tracked vs actual**: Clear comparison
2. **Link to Source**: Opens Curator Source page to find buyout totals
3. **Live preview**: Updates ROI/net calculations as they type
4. **Optional**: Not required, only for users who care about accuracy

---

## Technical Implementation

### Phase 1: Database Schema

**Migration: Add column to `official_totals`**
```sql
ALTER TABLE official_totals 
ADD COLUMN IF NOT EXISTS total_spent numeric DEFAULT 0;
```

### Phase 2: Hook Updates

**Update `useOfficialTotals.ts`**
- Add `total_spent` to the interface and upsert mutation

### Phase 3: New Component

**Create `SpendingOverrideSheet.tsx`**
```typescript
interface SpendingOverrideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackedSpending: number;
  currentOverride: number | null;
  onSave: (amount: number) => void;
  efpModeEnabled: boolean;
  totalFp: number;
}
```

### Phase 4: Integrate into UI

1. **InsightsDealsTab.tsx**: Make the "Avg Cost/EFP" card tappable to open the sheet
2. **EarningsBreakdownCard.tsx**: Add small "Adjust" link and use override in calculations
3. **RecapDealBreakdownSlide.tsx**: Use override in ROI calculations

### Phase 5: Calculation Logic

**Spending calculation with override:**
```typescript
const effectiveSpending = useMemo(() => {
  const trackedSpent = salesData?.totalSpent || 0;
  const officialSpent = officialTotals?.total_spent || 0;
  
  // Use the higher of: tracked OR official override
  // This handles: "I actually spent more than I tracked"
  return Math.max(trackedSpent, officialSpent);
}, [salesData, officialTotals]);
```

---

## Files to Modify

| File | Change |
|------|--------|
| `official_totals` table | Add `total_spent` column via migration |
| `src/hooks/useOfficialTotals.ts` | Add total_spent to interface and mutations |
| `src/components/goals/earnings/SpendingOverrideSheet.tsx` | New component for override input |
| `src/components/goals/EarningsBreakdownCard.tsx` | Add tap handler and use override |
| `src/components/insights/InsightsDealsTab.tsx` | Make Avg Cost card tappable |
| `src/components/recap/RecapDealBreakdownSlide.tsx` | Use effective spending in calculations |

---

## User Flow

1. User notices their ROI seems off (they know they spent more)
2. They tap the "Avg Cost / EFP" card on Insights or "Total Spent" in Earnings
3. Drawer opens showing tracked spending ($1,875)
4. User enters their actual total from Source ($2,340)
5. Preview shows updated ROI/net calculations
6. User saves → all ROI calculations now use the correct total
7. This persists as their official season spending baseline

---

## Edge Cases

- **Tracked > Override**: If user tracks more than their override, we use tracked (don't undercount)
- **No override set**: Falls back to tracked spending (current behavior)
- **Reset option**: Allow clearing the override to go back to tracked-only

---

## Why This Works

1. **Non-intrusive**: Only affects users who care about accuracy
2. **Familiar pattern**: Same as FP+/PRMR sync concept
3. **One-time setup**: Set it once per season, maybe update occasionally
4. **Accurate ROI**: Enables honest ROI calculations for data-driven reps
5. **Links to Source**: Helps users find their actual buyout totals

