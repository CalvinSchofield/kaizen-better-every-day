# Badge System Overhaul

## Changes Overview

### 1. Update Daily FP+ Emojis to Number Emojis

Update the `badge_definitions` rows for `daily_fp_2` through `daily_fp_10` to use number emojis: 2️⃣, 3️⃣, 4️⃣, 5️⃣, 6️⃣, 7️⃣, 8️⃣, 9️⃣, 🔟.

### 2. Add Rookie Quick-Win Badges (4 new badges)

New hidden=false, rookie_only=true, category="special", rarity="common" badges:

- `first_door` — 🚪 "First Door" — "Knocked your very first door"
- `first_transition` — 🚶 "First Transition" — "Got inside for the first time"
- `first_presentation` — 📋 "First Presentation" — "Gave your first full presentation"
- `first_sale` — 💰 "First Sale" — "Closed your very first deal"

Detection logic in `useBadgeDetection.ts`: check if the rep has ever had a nonzero value for each field. If today is the first day they've ever knocked a door (doors_knocked > 0 and no prior entries with doors_knocked > 0), award `first_door`, etc. `first_sale` replaces or supplements `first_blood` (which already exists but isn't rookie-only). ****This is just ofr their FIRST EVER tracked. also if they sync their numbers during setup and already have sales even though they are rookies, lets skip this badge earning

### 3. Expand Multi-Sale Streak Badges

Replace current 4 multi-sale definitions with expanded set:

**Double sales (min: 2):** 3, 6, 10, 12, 18, 24 day thresholds
**Triple sales (min: 3):** 3, 6, 10, 12, 18, 24 day thresholds  
**Quad sales (min: 4):** 3, 6, 10, 12, 18, 24 day thresholds

That's 18 new badge definitions total (replacing the current 4). Slugs: `streak_multi_2_3`, `streak_multi_2_6`, etc.

Update `badgeDefinitions.ts` MULTI_SALE_STREAKS array and insert corresponding rows into `badge_definitions` table.

### 4. Add Longer Sales Streak Thresholds

Current: [3, 5, 7, 10, 14, 21]. Extend to: [3, 6, 10, 12, 18, 24, 30, 36, 42, 60].  
Insert new `badge_definitions` rows for `streak_sales_30`, `streak_sales_45`, `streak_sales_60, etc`.

### 5. Live Sales Streak Display

Create a `useCurrentSalesStreak` hook that calculates the user's current consecutive working days with at least 1 sale (or FP+>0). This returns a number (e.g., 46).

Display this on the **Profile page** as a prominent counter near the top badges area — something like "🔥 46-Day Sales Streak" with a subtitle showing global ranking (see #6).

### 6. Global Badge Rarity Stats

Add a `useGlobalBadgeCount` hook that queries `user_badges` grouped by `badge_id` to get how many distinct users have earned each badge. Pass this count into `BadgeDetailSheet` to display "Only X reps have earned this badge" when viewing badge details.

For the live sales streak, query how many other users have ever reached that streak length or higher, and display "Only X reps have ever gotten this far."

### Technical Details

**Database changes (via migration tool):**

- INSERT ~22 new badge_definitions rows (4 rookie quick-wins + 18 multi-sale streaks + 3 extended sales streaks, minus 4 replaced multi-sale = net ~21 new rows)
- UPDATE 9 existing daily_fp rows to change `icon_emoji`

**Code file changes:**

- `src/utils/badgeDefinitions.ts` — update MULTI_SALE_STREAKS array, add SALES_STREAK extended thresholds, add SPECIAL_SLUGS for rookie badges
- `src/hooks/useBadgeDetection.ts` — add detection for first_door, first_transition, first_presentation, first_sale (check historical entries for prior nonzero values)
- `src/hooks/useCurrentSalesStreak.ts` — new hook, queries recent daily_entries descending, counts consecutive days with closes >= 1
- `src/hooks/useGlobalBadgeCount.ts` — new hook, queries count of distinct user_ids per badge_id from user_badges
- `src/components/badges/BadgeDetailSheet.tsx` — add globalCount prop, display "Only X reps have earned this" line
- `src/components/badges/BadgeGrid.tsx` — pass global counts to detail sheet
- `src/pages/Profile.tsx` — add live sales streak display with global comparison

**Streak clarification:** Yes, transition/presentation streaks count consecutive **working days** (days with entries). A 30-day transition streak means 30 entries in a row where the rep got at least 1 transition. Weekends/off days are simply gaps — the `calcStreak` function already works this way by walking consecutive entry dates, not calendar dates.