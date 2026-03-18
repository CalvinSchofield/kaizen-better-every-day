

## Redesign: Completed Competition Detail Sheet — Strava-style Race Recap

### The Problem
1. **Photo sizing bug**: The `CompletedMatchupHero` uses equal-sized avatars (`h-18 w-18`) for both participants — the loser isn't intentionally bigger, but the screenshot shows the right-side photo appearing larger due to the image content. Both are the same size, which doesn't emphasize the winner.
2. **The completed view is static and boring** — just shows final scores with avatars. No story of how the competition played out.

### The Vision: Strava/Runna-style "Race Recap"

When you tap a completed challenge, instead of just seeing final scores, you get a **scrollable race recap** that tells the story of the competition day-by-day:

```text
┌────────────────────────────────┐
│  🏆 Calvin Won!               │  ← clean result banner
│                                │
│   Calvin          Ansel        │  ← winner emphasized:
│   👑 [avatar]  [avatar]       │     bigger avatar, crown, glow
│     2.6          1.3           │
│  ───────●──────────────────── │  ← score bar
│     Won by 1.3 FP+            │
├────────────────────────────────┤
│  📈 Race Timeline             │  ← NEW: day-by-day story
│                                │
│  ┌─ Day 1 (Mar 10) ─────────┐│
│  │  Calvin: +0.8  │  Ansel: 0││  ← who got on the board first
│  │  Calvin takes the lead     ││
│  └────────────────────────────┘│
│  ┌─ Day 2 (Mar 11) ─────────┐│
│  │  Calvin: +0.5  │ Ansel:+1.3│  ← momentum shifts
│  │  Ansel fires back!         ││
│  └────────────────────────────┘│
│  ... cumulative line chart ... │  ← mini sparkline showing
│                                │     running totals over time
├────────────────────────────────┤
│  📊 Competition Stats         │  ← NEW: key stats
│                                │
│  Best Day    Calvin 0.8 FP+   │
│  Total Days  5 days            │
│  Margin      1.3 FP+          │
│  Lead Changes  2               │
├────────────────────────────────┤
│  📅 Mar 10 – Mar 14           │
│  🔒 Private challenge         │
│  ⚔️ Stakes: Loser buys lunch  │
└────────────────────────────────┘
```

### Technical Approach

#### 1. New hook: `useChallengeRecap`
Fetches `daily_entries` for both participants across the challenge date range, computing:
- **Day-by-day values** per participant for the challenge metric
- **Running totals** (cumulative score per day)
- **Lead changes** count
- **Best single day** per participant
- **Narrative moments** (who took the lead, biggest single-day performance, comeback detection)

Query: `daily_entries` filtered by `user_id IN (participants)`, `entry_date BETWEEN start_date AND end_date`, selecting the relevant metric column.

#### 2. Redesign `CompletedMatchupHero` (1v1)
- **Winner emphasis**: Winner gets a larger avatar (`h-20 w-20`) with a golden ring + crown. Loser gets smaller (`h-14 w-14`), slightly dimmed.
- **Clean layout**: Winner on left always, loser on right.
- Remove the oversized slider ball, keep the clean gradient bar.

#### 3. New component: `ChallengeRaceTimeline`
- A vertical timeline of key moments from the challenge, not every single day.
- Highlights: first to score, lead changes, biggest day, final day.
- Each moment is a small card with the date, what happened, and the running score.

#### 4. New component: `ChallengeRecapStats`
- Grid of 4 stat cards below the timeline:
  - **Duration**: "5 days"
  - **Margin**: "Won by 1.3"
  - **Best Day**: "Calvin — 0.8 FP+"
  - **Lead Changes**: "2"

#### 5. Update `ChallengeDetailSheet` completed section
Replace the current completed section with:
1. Result banner (keep, polish)
2. Redesigned matchup hero (winner emphasis)
3. Race timeline (new)
4. Recap stats (new)
5. Stakes + metadata (keep)

### Files to Create/Modify

| File | Action |
|---|---|
| `src/hooks/useChallengeRecap.ts` | **Create** — fetch daily entries for challenge period, compute timeline + stats |
| `src/components/competitions/ChallengeRaceTimeline.tsx` | **Create** — Strava-style vertical timeline of key moments |
| `src/components/competitions/ChallengeRecapStats.tsx` | **Create** — 2x2 stat grid |
| `src/components/leaderboard/ChallengeDetailSheet.tsx` | **Modify** — redesign `CompletedMatchupHero` (winner emphasis), integrate timeline + stats |

### Data Flow
The `useChallengeRecap` hook only runs when the challenge is completed. It queries `daily_entries` for each participant's metric values across the date range. This is lightweight — typically 2-10 days × 2 participants = 4-20 rows.

For team battles, the same approach applies but aggregated by team, with individual contributor highlights.

