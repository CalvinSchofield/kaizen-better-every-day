

## Fix Incentive Intra-Day Timeline: Legend + Priority Filtering

### Problems
1. **Wrong legend**: `SingleDayRaceTimeline` is built for 1v1 challenges — it hardcodes a 2-person legend (p1/p2 with primary/muted colors). For a 9-person group incentive, it picks 2 random top scorers and labels them "Ammon" and "Calvin" even though Ansel, Javier, etc. all appear in the timeline.
2. **Too overwhelming**: Every door batch, transition, close, and sale is shown flat. No hierarchy.

### Solution

#### 1. Create `IncentiveSingleDayTimeline.tsx` (new component)
A timeline designed for multi-participant incentives (not 1v1). Key differences from `SingleDayRaceTimeline`:
- **No 2-person legend**. Instead, each moment's dot/icon is colored by participant. Names are already inline so no legend needed, or a simple "X participants" label.
- **Tiered visibility** with expand/collapse:
  - **Always visible ("Key Activity")**: 
    - "Started knocking" moments
    - The competing metric's events (sales for FP+/PRMR, transitions for transitions, door batches for doors)
    - Sales are ALWAYS shown regardless of metric (they're the highest-signal event)
  - **Expandable ("More Details")**:
    - Orphan closes (presentations)
    - Orphan transitions (when metric isn't transitions)
    - Door batches (when metric isn't doors)
  - **Metric-aware logic**:
    - If metric is `fp_plus`/`prmr`: Show sales always. Closes/transitions/doors are drill-down.
    - If metric is `transitions`: Show transitions + sales always. Doors are drill-down.
    - If metric is `doors_knocked`: Show door batches + sales always. Transitions are drill-down.

#### 2. Update `IncentiveRaceTimeline.tsx`
Replace the `SingleDayRaceTimeline` usage with `IncentiveSingleDayTimeline` for single-day incentives. Pass all participant IDs (not just top 2).

#### 3. Update `useIncentiveRecap.ts` intra-day data
Add a `priority` field to each `RecapMoment` so the UI component can filter:
- `'high'`: competing metric events + sales (always)
- `'medium'`: closes/presentations  
- `'low'`: non-metric doors, transitions, pitches, decision makers

### Files

| File | Action |
|---|---|
| `src/components/competitions/IncentiveSingleDayTimeline.tsx` | **Create** — multi-participant timeline with priority tiers and expand/collapse |
| `src/hooks/useIncentiveRecap.ts` | **Modify** — add `priority` field to intra-day moments based on metric |
| `src/components/competitions/IncentiveRaceTimeline.tsx` | **Modify** — use new component instead of `SingleDayRaceTimeline` |

