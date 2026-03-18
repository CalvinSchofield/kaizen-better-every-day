

## Smarter Sorting for Goal Pace

### Current Problem
The sort is simplistic — just groups by status bucket (`behind → at_risk → on_pace → no_goals`). Within each bucket, reps appear in arbitrary order. A leader scanning 54 reps can't quickly identify who needs the most attention.

### Proposed Multi-Factor Sort

**Primary: Urgency Score** (composite, descending)
A computed score combining multiple signals so the "most actionable" reps float to the top:

```
urgencyScore = 
  (statusWeight)           // behind=100, at_risk=60, on_pace=0
  + (100 - pacePercent)    // lower pace% = higher urgency (capped 0-100)
  + (needsPlanning ? 20 : 0)  // planning gap bonus
  + (dailyNeeded > 3 ? 10 : 0) // high daily need = harder to recover
```

This means within the "Behind" bucket, a rep at 15% pace sorts above one at 65% pace. A "Behind" rep who also has 0 days planned sorts above one with days planned.

**Secondary: Sort options toggle**
Add a small sort dropdown/toggle in the drawer header letting leaders choose:
- **Urgency** (default) — composite score above
- **Pace %** — lowest pace first
- **YTD Production** — highest YTD first (spot top performers)
- **Name** — alphabetical

### Implementation

**File: `src/components/reports/v2/GoalPaceDrawer.tsx`**

1. Add sort state: `const [sortBy, setSortBy] = useState<'urgency' | 'pace' | 'ytd' | 'name'>('urgency')`
2. Add a compact sort toggle next to the filter chips (small icon + label like "Sort: Urgency ▼")
3. Replace the current simple sort (lines 213-216) with multi-factor sorting:

```typescript
const sorted = [...filtered].sort((a, b) => {
  switch (sortBy) {
    case 'urgency': {
      const statusWeight = { behind: 100, at_risk: 60, on_pace: 0, no_goals: -10 };
      const scoreA = statusWeight[a.status] + (100 - Math.min(100, a.dailyNeeded > 0 ? (a.userDailyAvg / a.dailyNeeded) * 100 : 0)) + (a.needsPlanning ? 20 : 0);
      const scoreB = statusWeight[b.status] + (100 - Math.min(100, b.dailyNeeded > 0 ? (b.userDailyAvg / b.dailyNeeded) * 100 : 0)) + (b.needsPlanning ? 20 : 0);
      return scoreB - scoreA; // highest urgency first
    }
    case 'pace': {
      const paceA = a.dailyNeeded > 0 ? a.userDailyAvg / a.dailyNeeded : 999;
      const paceB = b.dailyNeeded > 0 ? b.userDailyAvg / b.dailyNeeded : 999;
      return paceA - paceB; // lowest pace first
    }
    case 'ytd': return b.ytdFP - a.ytdFP;
    case 'name': return a.name.localeCompare(b.name);
  }
});
```

4. Add a small sort control in the drawer between the title and filter chips — a tappable row like:
```
Sort by: [Urgency ▼]  — tap cycles or opens a mini popover
```

This keeps the UI minimal while giving leaders meaningful control over how they scan their team.

