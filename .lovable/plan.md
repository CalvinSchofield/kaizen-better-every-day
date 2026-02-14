

# Auto-Toggle Home Page Based on Planned Work Days

## Overview
Replace the current manual knocking-mode toggle with automatic home page switching driven by whether today is a planned work day. Leaders retain an override toggle. This is the foundation for a future premium home page redesign.

## How It Works Today
The current `useAppMode` hook determines `isKnockingMode` through a complex priority chain: manual toggle > active blitz > summer period. This requires users to understand when to toggle and creates confusion when the mode doesn't match their day.

## How It Will Work

```text
+---------------------------+
|   Is today a planned      |
|   work day (or has the    |  YES --> Show Knocking Home
|   rep started tracking)?  |-------> (KnockingModeHome)
+---------------------------+
            | NO
            v
+---------------------------+
|   Show non-knocking home  |
|   (VetHome / PostBlitz    |
|   RookieHome / Rookie     |
|   Journey)                |
+---------------------------+

Leader Override:
  Leaders can manually force knocking view ON/OFF
  via existing toggle, overriding the planned-day logic.
```

## Changes

### 1. Update `useAppMode` Hook
Integrate `useTodayWorkStatus` into the knocking mode calculation:
- New priority chain: **Leader manual override > Active blitz > Today is planned OR has started work > Summer period fallback**
- The key change: if today is a planned work day (from `planned_work_days` table) OR the rep has already started tracking (has `work_start_time`), knocking mode activates automatically
- Summer period remains as a fallback for days not explicitly planned but within the summer window

### 2. Update Home Page Routing (`Home.tsx`)
- Pass the `isTodayPlanned` and `hasStartedWork` context through to determine which home to show
- No change to the actual component rendering -- `isKnockingMode` from the updated hook will naturally route to the correct view
- The existing `useTodayWorkStatus` hook already provides `isRestDay`, `shouldStartSoon`, etc. for contextual UI

### 3. Keep Leader Toggle Functional
- Leaders (Vets/Sophomores) keep the toggle in their settings/home
- When a leader manually sets knocking mode ON/OFF, that override takes precedence over the planned-day logic
- Non-leaders lose the toggle entirely -- their home is purely automatic

### 4. Edge Cases Handled
- **Rep starts tracking without planning the day**: `hasStartedWork` catches this, showing knocking home
- **Rest day but rep wants to check recruiting**: Non-knocking home shows automatically, no action needed
- **Blitz days**: Active blitz still forces knocking mode ON regardless of planned days
- **Summer period with no planned days**: Summer fallback still applies (rep forgot to plan but is in their summer window)

## Technical Details

### `useAppMode` priority chain update:
```text
1. Leader manual override (season_config.knocking_mode_enabled)
2. Active blitz (committed_blitzes date range)
3. Today is planned work day OR has started tracking
4. Within personal summer period
5. Default: OFF
```

### Files Modified:
- `src/hooks/useAppMode.ts` -- add planned-day awareness to `isKnockingMode` calculation
- `src/hooks/useTodayWorkStatus.ts` -- no changes needed, already provides the data
- `src/components/KnockingModeHome.tsx` -- minor: remove rest-day greeting logic duplication (it will now be handled by not showing this component on rest days)

### No Database Changes Required
All data already exists: `planned_work_days` table, `daily_entries.work_start_time`, and `season_config.knocking_mode_enabled`.

