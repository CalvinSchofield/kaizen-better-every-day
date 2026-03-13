## Use 2025 Summer Historical Pace for What-If Severity Coloring

### Problem

During preseason, the What-If drawer's severity colors (green/amber/red) use the **preseason daily average** to calibrate. Your preseason pace (1.5 EFP/day) is much lower than your summer pace (3 EFP/day). So Must Do at 2.8/day shows amber/red when it should be green — because you've proven you can do 3/day in the summer.

### Solution

Query the `historical_entries` table for 2025 summer knocking days (`season_type = 'summer'`, `season_year = 2025`), calculate the historical summer daily average, and use that as the severity baseline in the What-If drawer during preseason.

### Changes

`**src/components/goals/WhatIfScenarioDrawer.tsx**`

- Add a new prop `historicalSummerAvg?: number` (the 2025 summer daily average)
- Update `userDailyAvg` logic (line 230-235): When in preseason (`!isSummerStarted`) and `historicalSummerAvg > 0`, use `historicalSummerAvg` instead of the preseason average. This makes severity reflect "can I do this pace based on my proven summer ability?"
- Fall back to current preseason average if no historical data exists

`**src/pages/Goals.tsx**`

- Add a query for 2025 summer historical entries:
  ```typescript
  const { data: historicalSummerStats } = useQuery({
    queryKey: ['historical-summer-avg', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('historical_entries')
        .select('prmr, fp_plus, doors_knocked')
        .eq('user_id', userId)
        .eq('season_type', 'summer')
        .eq('season_year', 2025);
      // Calculate daily avg from entries with ≥4 doors
      ...
    },
    enabled: !!userId && !isUserSummerStarted,
  });
  ```
- Pass `historicalSummerAvg` to `WhatIfScenarioDrawer`

`**src/hooks/useGoalPaceCalculator.ts**`

- Same pattern: when in preseason and historical summer data exists, use that for severity calibration instead of preseason average. This ensures the unified goal progress severity also reflects summer capability.
- Add optional `historicalSummerAvg` to `GoalPaceInput` and use it in the severity calculation (lines 199-210)

### Result

- With ~3 EFP/day historical summer average, Must Do (2.8/day) and Will Do (3.0/day) both show **green**
- Could Do (3.2/day) would show **green** or **amber** depending on exact historical average
- Once summer actually starts and you have 7+ summer days, it switches to the live Summer pace THIS summer as long as the average is greater. If it's not, let's still show whichever is greater. Once we have 18 days of knocking in the new Summer at a minimum, then show the 2026 summer pace regardless of which is greater