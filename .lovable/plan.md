

# Smarter Spending Baseline: Additive vs Override + Scope Awareness

## The Problems You Identified

### Problem 1: Override discourages per-deal tracking
Current behavior: `Math.max(tracked, override)` means once you set an override, the app effectively ignores your per-deal tracking.

**Your scenario**: You have $X from legacy (pre-Dec 16) + ongoing tracked spending. You want BOTH to count.

### Problem 2: Time scope edge case
If you're looking at **this week's** performance, applying a full-season override would distort the data completely. The override should only apply to **season-level (YTD)** calculations.

---

## Solution: "Baseline Spending" (Additive) + Scope-Aware Application

### Rename & Reframe the Concept

Instead of "Total Spent Override", use **"Pre-Tracking Baseline"**:

```
┌─────────────────────────────────────────┐
│  Spending Baseline                      │
│                                         │
│  Enter spending from BEFORE you         │
│  started tracking per-deal costs:       │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Pre-Tracking Spending          │    │
│  │  $ [_______465_______]          │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Your tracked spending: $1,410          │
│  (from 45 deals since Dec 16)           │
│                                         │
│  ─────────────────────────────────────  │
│  Total Season Spending:                 │
│  $465 baseline + $1,410 tracked         │
│  = $1,875 total                         │
│                                         │
│         [ Save Baseline ]               │
└─────────────────────────────────────────┘
```

### How It Works

**Formula change:**
```typescript
// OLD (override replaces)
effectiveSpending = Math.max(trackedSpending, override);

// NEW (baseline adds)
effectiveSpending = baselineSpending + trackedSpending;
```

### Scope-Aware Application

| View Scope | Spending Used |
|------------|---------------|
| **Season/YTD** | `baseline + tracked` |
| **This Week** | `trackedThisWeek` only |
| **This Month** | `trackedThisMonth` only |
| **Custom Range** | `trackedInRange` only |

The baseline **only** applies to season-level metrics (Goals page earnings, YTD insights, recaps).

---

## Technical Implementation

### Phase 1: Rename Column (Semantic Clarity)

Rename `total_spent` → `baseline_spent` in the database (or add new column and migrate):

```sql
-- Option A: Rename existing column
ALTER TABLE official_totals 
RENAME COLUMN total_spent TO baseline_spent;

-- Add comment for clarity
COMMENT ON COLUMN official_totals.baseline_spent IS 
'Pre-tracking spending baseline. Added to tracked spending for season totals.';
```

### Phase 2: Update Hook Logic

**File: `src/hooks/useEffectiveSpending.ts`**

```typescript
interface UseEffectiveSpendingParams {
  trackedSpending: number;
  seasonType?: 'preseason' | 'summer';
  isSeasonScope: boolean; // NEW: Only add baseline for season-level views
}

export const useEffectiveSpending = ({
  trackedSpending,
  seasonType = 'summer',
  isSeasonScope = true, // Default to season scope
}: UseEffectiveSpendingParams) => {
  const { getTotals, isLoading } = useOfficialTotals(seasonType);
  
  const result = useMemo(() => {
    const totals = getTotals(seasonType);
    const baseline = totals?.baseline_spent ?? 0;
    const hasBaseline = baseline > 0;
    
    // Only add baseline for season-level calculations
    const effectiveSpending = isSeasonScope
      ? baseline + trackedSpending
      : trackedSpending;
    
    return {
      effectiveSpending,
      hasBaseline,
      baseline,
      trackedSpending,
      isSeasonScope,
      isLoading,
    };
  }, [getTotals, seasonType, trackedSpending, isSeasonScope, isLoading]);
  
  return result;
};
```

### Phase 3: Update SpendingOverrideSheet UI

Rename to `SpendingBaselineSheet` with clearer UX:

**Title**: "Spending Baseline" (not "Override")

**Input Label**: "Pre-Tracking Spending" or "Spending Before Dec 16"

**Calculation Display**:
```
Your pre-tracking baseline: $465
Your tracked spending: $1,410
───────────────────────────────
Total Season Spending: $1,875
```

**Help Text**: "Enter the amount you spent on buyouts, promos, etc. BEFORE you started logging costs per deal. This will be added to your tracked spending."

### Phase 4: Update Consumers

**Season-level views (add baseline):**
- `EarningsBreakdownCard.tsx` - Goals page earnings → `isSeasonScope: true`
- `InsightsDealsTab.tsx` when showing YTD → `isSeasonScope: true`
- `RecapSummarySlide.tsx` for season recaps → `isSeasonScope: true`

**Time-scoped views (tracked only):**
- `InsightsDealsTab.tsx` when showing "This Week" → `isSeasonScope: false`
- Weekly recap slides → `isSeasonScope: false`
- Any custom date range → `isSeasonScope: false`

---

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| User tracks everything from day 1 | Baseline = 0, works normally |
| User has legacy spending only | Baseline = X, tracked = 0, total = X |
| User has both | Baseline + tracked = total |
| Weekly view | Shows only that week's tracked spending |
| User clears baseline | Baseline = 0, back to tracked-only |

---

## Files to Modify

| File | Change |
|------|--------|
| `official_totals` table | Rename `total_spent` → `baseline_spent` |
| `src/hooks/useOfficialTotals.ts` | Update interface field name |
| `src/hooks/useEffectiveSpending.ts` | Add `isSeasonScope` param, change to additive logic |
| `src/components/goals/earnings/SpendingOverrideSheet.tsx` | Rename to baseline, update UI copy |
| `src/components/insights/InsightsDealsTab.tsx` | Pass `isSeasonScope` based on date range |
| `src/components/goals/EarningsBreakdownCard.tsx` | Pass `isSeasonScope: true` |

---

## User Experience

1. User goes to Insights → taps "Avg Cost / EFP" card
2. Sheet opens with title: **"Spending Baseline"**
3. User sees: "Enter spending from before you started tracking per-deal costs"
4. User enters $465 (their pre-Dec 16 buyouts from Source)
5. Sheet shows: "$465 baseline + $1,410 tracked = $1,875 total"
6. User saves → season calculations updated
7. Weekly insights still show only that week's tracked spending ✓
8. User continues logging per-deal costs and they ADD to the baseline ✓

---

## Why This Works Better

1. **Encourages ongoing tracking**: Baseline + tracked means both matter
2. **Accurate weekly views**: Baseline doesn't pollute time-scoped data
3. **Clear mental model**: "What I spent before" + "What I've tracked since"
4. **One-time setup**: Enter baseline once, then track normally
5. **Links to Source**: User can still verify their total against Vivint data

