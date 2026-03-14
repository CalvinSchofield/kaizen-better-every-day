

## Pending Install Reminder Notifications + UI Placement

### 1. Push Notifications for Pending Installs

Add pending install reminder logic to the existing `check-task-reminders` edge function (or create a dedicated `check-install-reminders` edge function). Two notification windows:

**9 PM local, day BEFORE scheduled install:**
- Title: `📦 Install tomorrow: $[PRMR] [FP/UP]`
- Body: `Scheduled for [date]. Text the customer to confirm?`
- Actions: `💬 Text Customer` (opens SMS with customer phone if available), `📋 View Sale`
- URL: `/customers` (opens customer detail)

**9 PM local, day OF scheduled install (or overdue):**
- Title: `📦 Was this installed? $[PRMR] [FP/UP]`
- Body: `Scheduled for today. Confirm, reschedule, or remove.`
- Actions: `✅ Confirm` (deep link to confirm action), `📋 Update`
- URL: `/customers?pendingInstall=[saleId]`

**Implementation:**
- File: `supabase/functions/check-task-reminders/index.ts` — add a `is9pm` window (hour === 21, minute < 15)
- Query `daily_entries` for sales_log containing `install_status: 'pending'` with `scheduled_install_date` equal to tomorrow (day-before reminder) or today/past (overdue reminder)
- Use existing `sendNotification` helper and dedup via `notification_logs` with types `install_reminder_eve` and `install_reminder_due`
- Add customer name from the sale's `customerName` field in sales_log (already stored there)

**Service worker updates:**
- File: `public/sw-custom.js` — add `install_reminder_eve` and `install_reminder_due` notification types with appropriate actions

### 2. UI Placement for Pending Install Card

The `PendingInstallAlertCard` currently only lives on home pages. During knocking season, the home page is `KnockingModeHome` which does show it, but only after 7 PM. Better placements:

**A. Customers page** — Add `PendingInstallAlertCard` at the top of the Customers page (always visible, no time restriction). This is the most natural place since it's where reps manage their sales. Remove the 7 PM time gate for this placement.

**B. Keep on KnockingModeHome** — Already there, keep as-is (with 7 PM gate).

**File changes for UI:**
- `src/pages/Customers.tsx` — import and render `PendingInstallAlertCard` at the top of the page content, before the search/filter bar
- `src/components/PendingInstallAlertCard.tsx` — add optional `alwaysShow` prop to bypass the 7 PM check. Customers page passes `alwaysShow={true}`, home pages keep current behavior.

### 3. Summary of File Changes

| File | Change |
|------|--------|
| `supabase/functions/check-task-reminders/index.ts` | Add 9 PM window with install reminder logic |
| `public/sw-custom.js` | Add `install_reminder_eve` and `install_reminder_due` action types |
| `src/components/PendingInstallAlertCard.tsx` | Add `alwaysShow` prop to bypass time gate |
| `src/pages/Customers.tsx` | Render `PendingInstallAlertCard alwaysShow` at top |

