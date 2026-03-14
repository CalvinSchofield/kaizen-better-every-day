## Current Scheduled-Out Logic & Proposed Changes

### How It Works Today

**Where scheduled-out (pending) sales COUNT:**

- **Leaderboards**: Counted on the day they were sold (via `calculateFromSalesLog` which only skips `never_installed`). This is correct per your preference.
- **Goals page** (`usePreseasonFP`): Counted immediately — pending sales are included in `totalFP`/`totalPRMR` alongside installed sales. Only `never_installed` is excluded. **This is what you want changed.**
- **Customer page**: Shows all sales regardless of status, with status badges.

**Where they DON'T count:**

- `never_installed` sales are excluded everywhere.
- `cancelled` sales are excluded from "funded" totals but still count toward goal progress.

### The Problem

Right now, a sale marked as `pending` (scheduled out) counts toward your Goals progress immediately. You're saying that's wrong — a scheduled-out sale is more likely to become a "never installed" than to actually fund. It should only count toward goals once confirmed as `installed`.

### Proposed Changes

**1. Update `calculateFromSalesLog` to skip `pending` sales**
File: `src/utils/salesLogCalculations.ts`

Currently only skips `never_installed`. Will also skip `pending` so that scheduled-out sales don't inflate live counters used by goals/pace.

**2. Update `usePreseasonFP` to exclude `pending` from goal totals**
File: `src/hooks/usePreseasonFP.ts`

The `allSales` filter (line 110) currently only excludes `never_installed`. Will also exclude `pending` from `totalFP`/`totalPRMR` (the goal progress numbers). Pending sales will still appear in `fundedFP`/`fundedPRMR`... actually no — funded should also exclude pending. Both `totalFP` and `fundedFP` will exclude `pending`.

**3. Leaderboards remain unchanged**
The leaderboard edge functions use `fp_plus`/`prmr` columns from `daily_entries`, which are set at save time and include pending sales. This keeps scheduled-out sales showing on the leaderboard the day they were sold — exactly what you want.

**4. Confirm/Resolve flow (already exists)**
The `PendingInstallAlertCard` already provides the UI for resolving pending sales. It appears on the Home page after 7 PM when there are overdue pending installs. The actions available are:

- **Installed** → marks as `installed` with `install_confirmed_at` timestamp
- **Reschedule** → picks a new date, keeps status as `pending`
- **Installed but Cancelled** → marks as `cancelled` (funded but customer cancelled) !!!! THIS AE NEED TO REMOVE!!!!! It's confusing. We shouldn't be able to mark as installed but canceled from this UI
- **Never Installed** → removes the sale entirely from the sales log

Users can also update status from the **Customer detail sheet** (`SaleDetailSheet`) at any time.

**5. Notifications gap**
There is currently **no push notification** for pending install reminders. The `PendingInstallAlertCard` only shows as a UI card on the home screen after 7 PM — it won't ping you if you don't open the app. Adding a push notification for overdue pending installs would be a separate task.

### Summary of File Changes


| File                                     | Change                                            |
| ---------------------------------------- | ------------------------------------------------- |
| `src/utils/salesLogCalculations.ts`      | Skip `pending` in addition to `never_installed`   |
| `src/hooks/usePreseasonFP.ts`            | Exclude `pending` sales from goal progress totals |
| `src/utils/salesLogCalculations.test.ts` | Update tests to reflect new logic                 |


### What This Means in Practice

- You sell a deal and schedule it out → it shows on the **leaderboard** that day, but does **not** count toward your **Goals** progress
- When the install date arrives, you get the `PendingInstallAlertCard` prompting you to confirm
- Once you tap "Installed" → it now counts toward Goals progress
- If you tap "Never Installed" → it's removed from everything