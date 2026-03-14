

# Consistent Goal Progress Colors + Drawer Fix

## 1. Hide Track from Drawer in Knocking Mode
**File: `src/components/AppDrawer.tsx`** — Line 298

Track is already in the bottom nav bar during knocking mode. Wrap it in `{!isKnockingMode && ...}` so it only appears in the drawer during preseason.

## 2. Add `funded` to TimeframeData
**File: `src/hooks/useGoalPaceCalculator.ts`**

- Add `funded: number` to `TimeframeData` interface (line 36)
- In `calcTimeframe()`, when iterating entries with `sales_log`, track funded separately: sales where `install_status` is NOT `pending`, `cancelled`, or `never_installed` count as funded; the remainder of actual is unfunded
- For the day timeframe, similarly split `todayFP` into funded vs unfunded using the sales_log
- Carry `funded` through `emptyTimeframe` default

## 3. Match Bar Colors to Ring
**File: `src/components/goals/UnifiedGoalProgress.tsx`**

Ring uses: Green (funded) → Blue (unfunded) → Yellow (pending)

New SegmentedBar segments (4 layers, left to right):

| Segment | Color | CSS |
|---------|-------|-----|
| Funded | Green | `bg-emerald-500` |
| Unfunded | Blue | `bg-primary` |
| Live | Green + pulse | `bg-emerald-500 animate-pulse` (same as funded, breathing animation) |
| Pending | Yellow | `bg-warning` |

- Accept `funded` prop in SegmentedBar, compute `unfunded = finalized - funded`
- Render 4 segments: funded (green) → unfunded (blue) → live (green + pulse) → pending (yellow)
- Update legend dots to match: green dot "Funded", blue dot "Unfunded", green pulsing dot "Live", yellow dot "Pending"
- Update inline text colors: `(+X live)` uses emerald instead of rose, `(+X pending)` uses warning instead of primary/60
- Same changes in both FullMode and CompactMode

### Files Changed
1. `src/components/AppDrawer.tsx` — hide Track in knocking mode
2. `src/hooks/useGoalPaceCalculator.ts` — add `funded` to TimeframeData
3. `src/components/goals/UnifiedGoalProgress.tsx` — 4-segment bar with ring-matched colors

