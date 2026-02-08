
# Post-Finalized Track Page Redesign

## Overview

This plan transforms the finalized Track page into a world-class, Apple Fitness-inspired "Day Recap" experience. The current implementation shows scattered components in a fixed order. A world-class approach uses a **scrollable, contextual card stack** that adapts based on what's relevant for that day.

## Design Philosophy

**World-class mobile apps prioritize:**
1. **Celebration first** - Start with the win (production summary)
2. **Glanceable insights** - Key metrics visible without scrolling
3. **Contextual content** - Show only what's relevant (competitions only if active, Me vs Me only if enabled)
4. **Progressive disclosure** - Tap for details, don't overwhelm
5. **Emotional connection** - 💰 emoji for sales, encouraging coaching tone

## New Component Architecture

```text
┌────────────────────────────────────────┐
│  Header: "Day Complete" + Time Range   │
│  [Calendar] [ℹ Legend] [🔄 Ring/Line]  │
├────────────────────────────────────────┤
│                                        │
│   🎯 Activity Ring (or Timeline)       │
│      FP+, PRMR, Duration in center     │
│      Interactive segments → Drawer     │
│                                        │
├────────────────────────────────────────┤
│ [Scrollable Card Stack - Contextual]   │
│                                        │
│ 1. Goal Result Card (daily goal hit?)  │
│ 2. Me vs Me Card (if enabled + data)   │
│ 3. Active Competitions (if any)        │
│ 4. Coaching Insights (effort flags)    │
│ 5. Stats Grid (doors, pitches, etc.)   │
│ 6. Sales Log Recap (💰 deals)          │
│                                        │
└────────────────────────────────────────┘
```

## Implementation Tasks

### 1. Header Enhancements
- Add **Ring/Line toggle** button (circle icon vs horizontal-lines icon) to switch between `ActivityRingHero` and `HorizontalActivityTimeline`
- Add **Legend (ℹ) button** that opens `ActivityRingLegend` drawer
- Keep **Calendar button** for activity history
- Persist visualization preference in localStorage

### 2. Activity Ring Updates
- Change sale segment emoji from ⭐ star to **💰 money bag** for sales
- Ensure `ActivityRingMini` also uses 💰 for sale days

### 3. Calendar Day Selection → Day Detail Drawer
- When user selects a **different day** from calendar, open a new `DayDetailDrawer`
- Fetches that day's `daily_entry` and displays Ring + Stats in a scrollable sheet
- Shows that day's sales log, coaching insights, goal status
- Allows navigation to adjacent days with swipe gestures

### 4. New Goal Result Card
Create `GoalResultCard` component that shows:
- Today's FP+ vs daily goal with progress bar
- "Goal Met! 🎉" or "X.X more needed" messaging
- Tier context (Preseason / Must Do / Will Do / Could Do)

### 5. Me vs Me Card (Enhanced)
Create `MeVsMeCard` for Track page with multiple comparison contexts:
- **YTD Comparison**: "12.5 EFP ahead of 2025 pace through day 132"
- **Week-to-Date**: "Beating your 2025 self by 2 FP this week"
- **Same Day Last Year**: "Last year on this date you had X FP"

### 6. Active Competitions Summary
Create `ActiveCompetitionsCard` for Track:
- Shows up to 2 active challenges/incentives
- Compact score slider with opponent/team progress
- Time remaining indicator
- Tap to navigate to full competition details

### 7. Enhanced Coaching Insights
Merge `SelfTimingInsights` + `BulkEntryCoaching` into unified `CoachingCard`:
- **Effort Flags** (late start, early end, long breaks) - encouraging tone
- **Bulk Entry Warning** if detected
- Frame as "Tips for Tomorrow" not "Concerns"

### 8. Stats Grid Improvements
Update `FinalizedStatsGrid`:
- Make Close/FP/PRMR rows clickable when `salesLog` has entries
- Clicking opens `SalesLogDrawer` for details

### 9. Sales Log Recap Card
Create `SalesRecapCard` component:
- Uses 💰 emoji header: "💰 Today's Deals"
- Horizontal scroll of sale chips showing customer name (if available), PRMR, time
- Tap chip to edit sale
- Shows FP + upgrade breakdown

## Technical Implementation

### New Files to Create
- `src/components/activity-ring/DayDetailDrawer.tsx` - Historical day viewer
- `src/components/activity-ring/GoalResultCard.tsx` - Daily goal progress
- `src/components/activity-ring/MeVsMeCard.tsx` - Historical comparison
- `src/components/activity-ring/CompetitionsCard.tsx` - Active challenges
- `src/components/activity-ring/CoachingCard.tsx` - Unified insights
- `src/components/activity-ring/SalesRecapCard.tsx` - Sales summary
- `src/components/activity-ring/VisualizationToggle.tsx` - Ring vs Line switcher

### Files to Modify
- `src/pages/Track.tsx` - Restructure finalized view with new card order
- `src/components/activity-ring/ActivityRingHero.tsx` - Add 💰 emoji for sales
- `src/components/activity-ring/ActivityRingMini.tsx` - Use 💰 instead of ⭐ for sale days
- `src/components/activity-ring/ActivityCalendarDrawer.tsx` - Open DayDetailDrawer on date select
- `src/components/activity-ring/FinalizedDayHeader.tsx` - Add legend + toggle buttons
- `src/components/activity-ring/index.ts` - Export new components

### Hooks Required
- `src/hooks/useVisualizationPreference.ts` - localStorage for ring vs line preference
- Leverage existing: `useMeVsMe`, `useMyActiveChallenges`, `useMyActiveIncentives`, `useChallengeProgress`

### Data Flow
1. Track page receives finalized `entry` with `salesLog` and `counterTimestamps`
2. Header renders with toggle (ring/line), legend button, calendar button
3. Visualization renders based on preference (Ring or Line)
4. Card stack renders conditionally based on:
   - Goal: Always if `goals.setup_complete`
   - Me vs Me: Only if `useMeVsMe().isEnabled` and historical data exists
   - Competitions: Only if active challenges/incentives
   - Coaching: Only if effort flags or bulk entry detected
   - Stats: Always
   - Sales: Only if `salesLog.length > 0`

## Visual Polish

- All cards use consistent `rounded-xl bg-muted/30 border border-border/30` styling
- Staggered entrance animations with `framer-motion`
- Card order prioritizes celebration (goals met, competitions won) over concerns
- Haptic feedback on all interactive elements
- Mobile-first: `active:scale-[0.97]` press states, no hover effects

## Summary

This redesign transforms the finalized Track page from a static display into an engaging, personalized recap that:
1. Celebrates wins prominently
2. Shows contextual comparisons (Me vs Me, competitions)
3. Provides actionable coaching tips
4. Gives quick access to detailed drill-downs via drawers
5. Maintains premium iOS native feel throughout
