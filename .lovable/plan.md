# Streak Protection System + Name Cleanup

## Part 1: Name Emoji Cleanup

Run a one-time SQL UPDATE on the `reps` table to strip emojis from all `name` values using a regex replace. This is a data operation via the insert tool.

```sql
UPDATE reps 
SET name = TRIM(regexp_replace(name, '[^\x20-\x7E\xC0-\xFF]', '', 'g'))
WHERE name ~ '[^\x20-\x7E\xC0-\xFF]';
```

This strips any non-ASCII-printable characters (emojis, special unicode) while preserving standard Latin characters.

---

## Part 2: Never-Installed Sales & Streaks

The current streak logic checks `closes >= 1` from `daily_entries.closes`. When a sale is marked `never_installed`, the `upsert_daily_entry_safe` function recalculates `closes` excluding those sales. So if all of a day's sales become `never_installed`, `closes` drops to 0 and the streak would break on the next detection run.

**Gap identified**: Streak badges already awarded don't get revoked. And `useCurrentSalesStreak` (the live counter) also uses `closes` — so it would retroactively show a shorter streak if a past day's closes drop to 0. This is actually correct behavior, but we should also make the **badge detection re-evaluate** when sales statuses change (not just when new entries are made). This would be a cache invalidation fix — when a sale is marked never_installed, invalidate the streak queries.

**Action**: Add streak query invalidation to the sale status update flow. No schema change needed.

---

## Part 3: Streak Protection System

### Data Model

New table: `streak_protections`

```
id              uuid PK
user_id         uuid NOT NULL
entry_date      date NOT NULL (the day protection was used)
protection_type text NOT NULL ('earned' | 'recovery')
method          text NOT NULL ('doors_150' | 'presentations_150' | 'recovery_sales' | 'recovery_doors')
baseline_value  numeric (their average used as baseline)
actual_value    numeric (what they actually hit)
streak_length   integer (streak length at time of protection)
created_at      timestamptz
UNIQUE(user_id, entry_date)
```

RLS: users can view/insert their own protections. Leaders can view downline.

### Protection Logic (4 Parts)

**1. Earned Protection (effort-based, personalized)**

When a rep doesn't sell on a knocking day, check if they earned protection:

- Calculate their **personal 14-day rolling average** for doors and presentations (from their own daily_entries, excluding Sundays)
- If `today_doors >= CEIL(their_avg_doors * 1.5)` → protection earned via doors
- If `today_presentations >= CEIL(their_avg_presentations * 1.5)` → protection earned via presentations
- Both are checked; either qualifies

This is fully personalized — a rep averaging 80 doors needs 120, a rep averaging 40 needs 60.  
*******INSTEAD OF 14 DAY ROLLING AVERAGE, USE SEASON AVERAGE. (EX. SUMMER KNOKCING DAYS IS DIFFERENT THAN PRSEASON KNOCKING DAYS). 

**2. Weekly Limit**

- Vets: max 1 protection per rolling 7-day window
- Rookies: max 2 per rolling 7-day window
- Check `streak_protections` table for recent uses before allowing

**3. Visual Distinction**

- Clean streak: 🔥 only
- Streak with protection(s) used: 🔥🛡️
- Track `protections_used` count in the streak display
- On profile pill: "🔥 46-Day Streak" vs "🔥🛡️ 46-Day Streak (2 shields used)"
- On badge detail / watchlist: show shield count

**4. Streak Recovery**

When streak is lost:

- Calculate their **season-specific daily average** FP+ (preseason vs summer, from daily_entries within that season window)
- Over the next 2 knocking days (skip Sundays), they must either:
  - Sell `>= CEIL(avg_daily_fp * 2)` total FP+ OR PRMR across those 2 days, OR
  - Knock `>= CEIL(avg_daily_doors * 2)` total doors across those 2 days
- If achieved, streak is restored (with a recovery marker)
- Recovery window expires after 2 knocking days — no second chances  
******MAKE SURE THAT STREAK RECOVERY CAN BE EARNED FROM 2x FP+ OR 2x PRMR*******

New table: `streak_recovery_windows`

```
id              uuid PK
user_id         uuid NOT NULL
streak_lost_on  date NOT NULL
recovery_deadline_date date (2nd knocking day after loss)
knocking_days_used jsonb DEFAULT '[]' (dates counted)
target_fp       numeric
target_doors    numeric
status          text ('active' | 'recovered' | 'expired')
restored_streak integer (the streak length being recovered)
created_at      timestamptz
```

### Integration Points

- `**calcStreak` function**: Modified to check `streak_protections` table — if a day has `closes = 0` but has a valid protection record, the streak continues
- `**useCurrentSalesStreak**`: Same logic — factor in protections
- **Badge detection**: After entry finalization, check if protection was earned
- **Recovery detection**: After each finalization during an active recovery window, check if targets are met

### Anti-Gaming Design

The user asked how to balance transparency vs gaming. Here's the approach:

**What we show**:

- "Your streak is protected today! 🛡️" — after they've already earned it through effort (post-hoc notification)
- "You have X shield(s) available this week" — so they know the mechanic exists
- Recovery: "You can earn your streak back over the next 2 knocking days" — vague on specifics

**What we DON'T show**:

- The exact 150% multiplier
- The exact door/presentation count needed
- The exact recovery targets
- Instead, use language like "exceptional effort" and "put in significantly more work than usual"

**UI copy examples**:

- Protection earned: "Your effort today earned you a streak shield! 🛡️"
- No sale, no protection: "Streak broken. Put in exceptional work over the next 2 days to earn it back."
- Recovery earned: "Incredible effort! Your streak has been restored. 🔥"

This way reps know the system exists and rewards effort, but can't precisely calculate the minimum threshold to game it.

---

## Fairness Review & Considerations

**What's good:**

- Fully personalized baselines — a 50-door/day rep and a 100-door/day rep have different thresholds
- Season-aware averages for recovery (preseason vs summer)
- Weekly limits prevent abuse
- Visual distinction rewards clean streaks

**Things to consider:**

1. **New reps with no history**: If a rookie has only 2 days of data, their "average" is unreliable. Suggest: require minimum 5 knocking days of history before protection is available. Before that, use a reasonable default floor (e.g., 60 doors minimum for protection). *******FAIR. FOR ROOKIES USE A DEFAULT OF 60 DOORS MINIMUM. FOR VETS, USE A MINIMUM OF 2 TRANSITIONS AS A DEFAULT UNTIL 5+ KNOCKING DAYS
2. **Sunday exclusion**: The system should skip Sundays when counting "next 2 knocking days" for recovery. Already accounted for in the plan.
3. **What counts as a "knocking day"?**: A day with an entry where `doors_knocked > 0`. Days with 0 doors but a sale (e.g., a callback close) should probably not count as knocking days for average calculations. *****FAIR. DONT COUNT THOSE DAYS WHERE REFERRALS WERE DONE OR SOMETHING OF THE SORT AND SALES WERE LOGGED BUT WORK WASNT*****
4. **Retroactive never_installed**: If a sale that saved a streak is later marked never_installed, should the streak retroactively break? This gets complex. Suggest: once a day is "locked in" as a streak day (entry finalized), it stays. Only live/today's status matters for current detection. ****THATS FINE*****
5. **Multiple protections in a row**: With rookies getting 2/week, they could theoretically go 2 days without selling and keep the streak. This seems acceptable given they're putting in 150% effort those days.
6. **The recovery window creates urgency**: 2 knocking days is tight — this is intentional and good. It prevents someone from coasting and recovering weeks later.

---

## Files to Change

1. **Database**: Create `streak_protections` and `streak_recovery_windows` tables with RLS
2. `**src/utils/badgeDefinitions.ts**`: Add streak protection constants
3. `**src/hooks/useBadgeDetection.ts**`: Update `calcStreak` to consult protections table; add protection earning logic; add recovery detection
4. `**src/hooks/useCurrentSalesStreak.ts**`: Factor in protections when calculating live streak; include protection count in return
5. `**src/hooks/useStreakProtection.ts**` (new): Hook for checking/using protection status, recovery windows
6. `**src/pages/Profile.tsx**`: Update streak pill to show 🛡️ when protections used
7. `**src/components/leaderboard/WatchlistDrawer.tsx**`: Show shield indicator
8. **One-time SQL**: Strip emojis from reps.name