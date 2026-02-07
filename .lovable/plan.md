
# Activity Ring UX Improvements Plan

## Overview
This plan addresses several UX issues with the Rep Drill-Down drawer, focusing on:
1. Consolidating redundant goal progress displays
2. Adding timeframe toggles (Day/Week/Month/Year) for goal tracking
3. Fixing the Legend to open a drawer instead of popover, and moving it to the header
4. Making ring segments (gaps, sales, presentations) tappable with detail drawers

---

## 1. Remove Redundant Goal Progress Section

**Current Issue:**
- Goal progress appears TWICE: once in the inner ring + badge, and again in the `RingGoalProgress` component below
- Also `RepGoalPaceCard` shows similar information with all tier breakdowns

**Solution:**
- Remove the separate `RingGoalProgress` component from `RepDrillDownDrawer`
- Keep the inner goal ring + "X% of goal" badge in `ActivityRingHero`
- Retain `RepGoalPaceCard` for the detailed tier breakdown (Must/Will/Could Do), but move it below the stats grid
- This eliminates ~150px of vertical redundancy

---

## 2. Timeframe Goal Progress Toggle

**Design Approach** (inspired by Apple Fitness rings):
- Add a compact segmented control: `Day | Week | Month | Year`
- Place it just below the activity ring, replacing the current "X% of goal" badge
- When toggled, the inner goal ring animates to reflect the selected timeframe's progress

**Implementation:**
- Create a new `GoalTimeframeToggle` component with pill-style tabs
- Pass selected timeframe to `ActivityRingHero` to recalculate goal progress:
  - **Day**: `todayFP / dailyNeed`
  - **Week**: sum of FP for current week / (dailyNeed × 7)
  - **Month**: sum of FP for current month / (dailyNeed × days in month)
  - **Year/Season**: total season FP / focusTierGoal

**Data Requirements:**
- `useRepDayActivity` already provides daily data
- Weekly/monthly data can be derived from `calendarData.summaries` already fetched
- Season data is already available in `extendedData`

---

## 3. Legend Drawer (Not Popover)

**Current Issue:**
- `ActivityRingLegend` uses `Popover` which isn't responding properly on mobile
- Takes up vertical space below the ring

**Solution:**
- Replace `Popover` with a `Drawer` that slides up from the bottom
- Move the legend trigger button to the drawer header (top-right corner), next to the close X button
- Style as a minimal `Info` icon that opens the legend drawer on tap

**New Location:**
```text
┌──────────────────────────────────────┐
│ Christian Fabian   [Sophomore]  [ⓘ][✕] │  ← Legend button added here
│ Christian Fabian                      │
└──────────────────────────────────────┘
```

---

## 4. Clickable Ring Segments with Detail Drawer

**Current Issue:**
- Segments have click handlers but only open desktop-style popovers
- Need mobile-native drawer experience with sale details

**Solution:**
Create a `SegmentDetailDrawer` component that opens when tapping segments:

**For Sale Segments:**
- Duration (time in home)
- PRMR/Money
- Sale type (FP vs Upgrade)
- Deal type (Fresh/Takeover/DIY) if logged
- Difficulty (Easy/Medium/Hard) if logged
- Customer info if CRM enabled

**For Presentation Segments (no close):**
- Duration
- "No sale logged" indicator
- Option to log sale from here (stretch goal)

**For Gap Segments:**
- Duration
- Context: what happened before/after
- "Coaching opportunity" callout if >20 min

**For Break Segments:**
- Duration
- Start/end time

**Implementation:**
- Add new `SegmentDetailDrawer` component
- Track `selectedSegment` state with full segment data
- Map segment to nearest sale in `salesLog` for enriched data
- Use same visual styling as `SaleDetailSheet` for familiarity

---

## Technical Implementation Details

### Files to Modify:

1. **`src/components/activity-ring/ActivityRingHero.tsx`**
   - Remove Popover-based segment details
   - Add `onSegmentClick` prop to bubble segment taps up
   - Accept new `goalTimeframe` prop

2. **`src/components/activity-ring/ActivityRingLegend.tsx`**
   - Convert from Popover to Drawer
   - Export trigger button separately for header placement

3. **`src/components/reports/v2/RepDrillDownDrawer.tsx`**
   - Remove `RingGoalProgress` component usage
   - Add legend button to header
   - Add timeframe toggle below ring
   - Add `SegmentDetailDrawer` with state management
   - Calculate weekly/monthly goal progress from calendar data

4. **New: `src/components/activity-ring/SegmentDetailDrawer.tsx`**
   - Read-only drawer showing segment details
   - Sale details UI borrowed from `SaleDetailSheet`
   - Gap/break context display

5. **New: `src/components/activity-ring/GoalTimeframeToggle.tsx`**
   - Compact D|W|M|Y toggle with pill styling
   - Returns selected timeframe for goal calculation

### Data Flow:

```text
RepDrillDownDrawer
  ├── [Header: Name, Badge, Legend ⓘ, Close ✕]
  ├── WeekActivityStrip
  ├── ActivityRingHero
  │     └── (inner goal ring uses goalTimeframe)
  ├── GoalTimeframeToggle [D|W|M|Y]
  ├── FinalizedStatsGrid
  ├── CoachingCallouts
  ├── RepGoalPaceCard (detailed tiers)
  └── SegmentDetailDrawer (when segment tapped)
```

---

## Summary of Changes

| Change | Vertical Space Saved | UX Improvement |
|--------|---------------------|----------------|
| Remove `RingGoalProgress` | ~150px | Eliminates redundancy |
| Move Legend to header | ~40px | Cleaner layout |
| Add timeframe toggle | +30px | More insight options |
| Segment drawers | N/A | Mobile-native details |

**Net Effect:** Cleaner, more focused view with ~160px less scroll, plus new capabilities for exploring data at different timeframes and tapping into segment details.
