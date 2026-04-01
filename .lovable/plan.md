# Leader AI Chat for Reports Page

## Summary

Add the same AI chat interface from the Insights page to the Reports (V2) page, allowing leaders to ask questions about their entire downline/group's data. The chat will be powered by a new edge function (`leader-insights-chat`) that aggregates data for all reps the leader has access to.

## Difficulty: Medium-High

The UI is straightforward (reuse InsightsChat component). The heavy lift is building the new edge function that aggregates multi-rep data into a coherent system prompt.

---

## Architecture

### 1. New Edge Function: `supabase/functions/leader-insights-chat/index.ts`

This is the core work. It will:

- **Auth & Access Scoping**: Use the caller's token to invoke `fetch-team-access` server-side, getting their `accessibleUserIds` and `accessLevel`. For Area Directors, this already includes all office reps (not just downline). Include the leader themselves in the data set.
- **Bulk Data Fetching** (using service role client, in parallel):
  - `daily_entries` for all accessible user IDs (full season)
  - `reps` table (name, year, timezone, efp_mode_enabled, recruiter)
  - `rep_goals` for all accessible users (must-do/will-do/could-do, focus tier, weeks_working, monthly_expenses, etc.)
  - `planned_work_days` for all accessible users
  - `season_config` for all accessible users
  - `teams`, `mgmt_groups`, `recruits` for org structure context (team names, MGMT group names, who's on which team)
  - Team/MGMT membership mapping (reuse logic from `fetch-team-insights`)
- **System Prompt Construction** — structured sections:
  1. **Persona**: Professional leader coach. Direct, data-driven, actionable. Knows Vivint D2D context.
  2. **Org Structure**: List of teams, MGMT groups, and which reps belong to each.
  3. **Per-Rep Summaries**: For each rep — name, year, team, season totals (doors/DMs/pitches/transitions/presentations/closes/FP+/PRMR), funnel rates, avg hours/day, goals (must-do/will-do/could-do), planned days remaining, current pace, projected total.
  4. **Rolling 14-Day Baselines**: Team-level and per-rep rolling averages (reuse `baselineCalculations.ts` logic server-side). This enables "skill gap vs their own baseline" questions.
  5. **Team Funnel Aggregates**: Combined funnel rates for the group, by team, by MGMT group — enabling "where's the biggest dropoff" questions.
  6. **Deal Analytics**: All sales across the group with hour-of-day, type (FP/upgrade), PRMR, money spent, time-to-sell. Enables "what time do we sell FP most?" and "how much are we spending per FP on Wednesdays before 6pm?"
  7. **Schedule & Forecasting**: Each rep's planned days, who has off days during specific weeks, group forecast based on pace × remaining planned days.
  8. **Vivint Reference**: Same payscale/PRMR adder/deduction reference as the individual chat.
- **Key prompt rules**:
  - Compare reps against the group's own rolling 14-day baseline (not hardcoded standards). *****CLOSE. I want to be able to compare reps against themselves and groups against themselves. Not reps compared to the group in most cases. Questions like "how is Quinn doing this week compared to last week". Also the comparisons aren't helpful with only rolling day -- what if I want to compare this month vs last month time of day I'm selling on average Monday -- Friday? Or my average PRMR week 12 vs week 1 of the summer? Or my door to transition ratio change throughout the course of the summer so far week by week? And what if I want to be able to do that at a team level? 14 days isn't enough. It's helpful when comparing some baselines but I guess it should compare against season averages unless explicitly stating a 14 day rolling average, or "recent average"*****
  - Prescribe coaching actions: "Their door-to-DM ratio dropped 50% this week vs last — talk about prospecting"
  - Include the leader in all group totals and forecasts
  - Keep responses under 200 words unless deep dive requested

### 2. Reusable Chat UI Component: `src/components/reports/v2/LeaderChat.tsx`

- Reuse `InsightsChat` component with minor adaptations:
  - Different `CHAT_URL` pointing to `leader-insights-chat`
  - Different suggested prompts relevant to leaders:
    - "What's the team's biggest funnel dropoff this week?"
    - "Who's off pace for their goal?"
    - "What time of day are we selling the most FP?"
    - "How's [rep name] doing compared to last week?"
    - "Give me coaching priorities for today"
    - "Who has days off planned next week?"
  - Title: "Team AI Coach" instead of "AI Coach"
  - Placeholder: "Ask about your group's numbers..."
- To avoid duplication, refactor the streaming/chat logic from `InsightsChat.tsx` into a shared `ChatOverlay` component that accepts `chatUrl`, `suggestedPrompts`, `title`, and `placeholder` as props. Both Insights and Reports use this shared component.

### 3. Integration into ReportsV2 Page

- Add a floating AI button (Sparkles icon) in the bottom-right corner of the Reports V2 page
- Tapping opens the fullscreen `LeaderChat` overlay (same UX as Insights chat)
- Only visible to users with `accessLevel !== 'none'` (i.e., leaders)

### 4. Improvements to Individual Insights Chat

Based on the feature parity questions raised, the existing `insights-chat` already has goals, pace, planned days, sales detail, and schedule data. Two additions needed:

- **Rolling 14-day baseline for self**: Add the rep's own 14-day rolling averages to the individual prompt so they can ask "how does this week compare to my average?" Currently it only has weekly/monthly buckets but no explicit baseline comparison. ******same thing here -- what if I want more rich comparisons? 14 days shouldn't be the standard or default it should be season averages I'm comparing to
- **Funnel drop-off analysis**: Add a section computing week-over-week funnel rate changes to support "where am I losing deals compared to last week?"

---

## Technical Considerations

- **Token limits**: With many reps (50+), the system prompt could get large. Mitigate by summarizing per-rep data compactly (one line per rep for overview, detailed only for recent 2 weeks). Cap sales detail at the most recent entries if the group exceeds ~200 total sales.
- **Performance**: The edge function will make ~6-8 parallel DB queries. Should complete in 2-4 seconds for typical groups (5-30 reps).
- **Model choice**: Use `google/gemini-2.5-flash` (same as individual chat) — good balance of speed and reasoning for this data volume.

---

## Files to Create/Edit


| File                                               | Action                                                       |
| -------------------------------------------------- | ------------------------------------------------------------ |
| `supabase/functions/leader-insights-chat/index.ts` | **Create** — new edge function                               |
| `src/components/shared/ChatOverlay.tsx`            | **Create** — extracted shared chat UI                        |
| `src/components/insights/InsightsChat.tsx`         | **Edit** — use shared ChatOverlay                            |
| `src/components/reports/v2/LeaderChat.tsx`         | **Create** — leader chat wrapper                             |
| `src/pages/ReportsV2.tsx`                          | **Edit** — add floating AI button + LeaderChat               |
| `supabase/functions/insights-chat/index.ts`        | **Edit** — add 14-day baseline + week-over-week funnel delta |
