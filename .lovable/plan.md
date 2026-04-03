

# Summer Availability Fixes + Weekly Report Expansion

## Changes

### 1. Sort reps: "in-range with activity" first, collapse out-of-range at bottom
In `SummerAvailabilityView.tsx`, split `readyPeople` into two groups:
- **Active this week**: Reps whose summer range overlaps the displayed week AND have at least one excluded (off) day or are working that week
- **Out of range**: Reps whose entire week falls before their start date or after their end date

Show active reps first in the grid. Render out-of-range reps in a collapsible section below (similar to "Needs Setup"), defaulted to collapsed.

### 2. Show profile photos
The `reps` table has `profile_photo_url`. Add it to the team data query (`select` includes `profile_photo_url`), pass it through `PersonSummerInfo`, and replace the letter-initial circle with an `Avatar`/`AvatarImage`/`AvatarFallback` component (already used elsewhere in the project).

### 3. Fix "Off This Week" count -- only count actually excluded days, not out-of-range
Currently `offThisWeekCount` counts reps where `dayStr < start || dayStr > end` as "off". Change this to only count reps who have at least one `excludedSummerDays` entry matching the displayed week. Out-of-range is not "off" -- it means they haven't started or already ended.

### 4. Fix the weekly report's off-day logic the same way
In `weekly-availability-report/index.ts`, the current logic counts reps as "off" if the date falls outside their summer range. Change to only report reps who have explicit `excluded_summer_days` entries for next week's dates.

### 5. Expand report recipients to include MGMT Group Leaders
Currently the report only queries `office_staff` for `area_director` role. Add a second query to `mgmt_groups` to get all `lead_user_id` values. For each MGMT group leader, scope the report to reps in their MGMT group's teams (using the recruits/team membership chain). Send each leader a report scoped to their downline only.

### 6. Fix cron schedule to 11 AM Pacific every Sunday
11 AM California time = 18:00 UTC (during PDT) or 19:00 UTC (during PST). Since April-November is PDT, use `0 18 * * 0` for the cron expression. The cron job will be re-created/updated with this schedule.

## Files to modify

| File | Change |
|---|---|
| `src/components/mygroup/SummerAvailabilityView.tsx` | Add `profile_photo_url` to query, use Avatar components, split grid into active/collapsed out-of-range, fix offThisWeekCount to excluded-only |
| `supabase/functions/weekly-availability-report/index.ts` | Rewrite: add MGMT group leaders as recipients with scoped reports, fix off-day logic to excluded-only, clean up dead code |
| Cron job (via SQL insert tool) | Schedule `0 18 * * 0` (11 AM PDT Sunday) |

