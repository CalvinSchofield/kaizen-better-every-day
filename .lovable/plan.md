# Notification System Audit & Recommendations

## Current Notification Inventory

### A. Event-Triggered (Real-time, fired from client actions)


| #   | Function                            | Trigger                                                             | Web Push | APNs              | Status                   |
| --- | ----------------------------------- | ------------------------------------------------------------------- | -------- | ----------------- | ------------------------ |
| 1   | `send-comment-notification`         | Someone comments on your recruit activity                           | Yes      | Yes               | Working                  |
| 2   | `send-mention-notification`         | Someone @mentions you in a comment                                  | Yes      | **No** (has TODO) | Partial — APNs not wired |
| 3   | `send-reaction-notification`        | Someone reacts to your recruit activity                             | Yes      | Yes               | Working                  |
| 4   | `send-challenge-notification`       | Challenge invite/accept/decline/complete, incentive create/complete | Yes      | Yes               | Working                  |
| 5   | `send-task-assignment-notification` | A task is assigned to you by a leader                               | Yes      | Yes               | Working                  |
| 6   | `send-access-request-notification`  | New rep requests access (notifies upline leaders 3 layers up)       | Yes      | Unknown           | Working                  |


         ***lets also add a notifciation to the upline (3 layers up) when a rep marks a onboarding task as completed and is waiting on approval to move to the next step

### B. Scheduled/Cron (should run on a timer)


| #   | Function                            | Purpose                                                                                                        | Cron Job Exists? | Status                            |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------- |
| 7   | `check-inactivity-notifications`    | 60-min idle motivational nudge + 9pm "save your day" reminder (IF they are working and have tracked doors etc) | **No cron job**  | Only runs manually from Dev Tools |
| 8   | `check-task-reminders`              | 9am digest, 6pm nudge, 9pm install reminders                                                                   | **No cron job**  | Only runs manually                |
| 9   | `check-blitz-rsvp-reminders`        | 21-day and 10-day blitz RSVP asks                                                                              | **No cron job**  | Only runs manually                |
| 10  | `check-ramp-progress-notifications` | Nudges rookies stuck on ramp phases                                                                            | **No cron job**  | Only runs manually                |
| 11  | `check-preseason-accountability`    | Weekly preseason commitment reminder (****remind the rookie of their preseason commitments once a week)        | **No cron job**  | Only runs manually                |
| 12  | `auto-finalize-entries`             | Auto-saves day at midnight                                                                                     | **Yes** (hourly) | Working                           |


### C. Known Issues

1. **No cron jobs for 5 scheduled functions** — `check-inactivity-notifications`, `check-task-reminders`, `check-blitz-rsvp-reminders`, `check-ramp-progress-notifications`, and `check-preseason-accountability` all exist but have no `pg_cron` schedule. They only fire when you manually trigger them from Developer Tools.
2. `**send-mention-notification` missing APNs** — Has a TODO comment: "Add APNs sending for native iOS when ready". Mentions won't reach TestFlight users.
3. `**check-inactivity-notifications` is web-push only** — Doesn't call `send-apns-notification`, so native app users never get idle nudges.

---

## Recommended New Notifications

Based on the daily tracking workflow and what reps actually do in the app:

### High Impact


| Notification                       | When                                                                                                                                                                                                                     | Why                                                                            | &nbsp;                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------- |
| **"Start Your Day" morning nudge** | noon local on PLANNED work days if `work_start_time` is null                                                                                                                                                             | Reps plan days but forget to start tracking. A nudge gets them going.          | &nbsp;                                 |
| &nbsp;                             | &nbsp;                                                                                                                                                                                                                   | &nbsp;                                                                         | &nbsp;                                 |
| **Personal record celebration**    | Immediately when `check-personal-records` detects a new PR (notify upline 3 layers up if it is a FP+/PRMR record too, otherwise just the rep if its an inputs record)                                                    | "New PR! You knocked 47 doors today — your best ever!" Massive morale booster. | &nbsp;                                 |
| **Leader coaching nudge**          | Mornings (9am) on days when a rep in their direct downline hasn't sold in 2+ days (knocked but not sold -- no FP+ or PRMR logged). Also notify 2 layers up (ex. my recruit hasn't sold in 2 days, notify me and my boss) | &nbsp;                                                                         | Keeps leaders engaged with their team. |


### Medium Impact


| Notification                       | When                                                                                                            | Why                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Sale pending install follow-up** | Already partially built in `check-task-reminders` (9pm install reminders). Could add a day-of morning reminder. | Installs that don't happen = lost revenue.                                 |
| &nbsp;                             | &nbsp;                                                                                                          | &nbsp;                                                                     |
| **Challenge progress update**      | Daily at 6pm during active challenges                                                                           | "You're 2 closes behind [opponent]. 3 days left!" Drives competitive fire. |


### Lower Priority


| Notification | When   | Why    |
| ------------ | ------ | ------ |
| &nbsp;       | &nbsp; | &nbsp; |
| &nbsp;       | &nbsp; | &nbsp; |


---

## Implementation Plan

### Phase 1: Fix what's broken (critical)

1. **Create cron jobs** for the 5 scheduled functions that are missing them (`check-inactivity-notifications` every 15 min, `check-task-reminders` every 15 min, `check-blitz-rsvp-reminders` daily, `check-ramp-progress-notifications` daily, `check-preseason-accountability` weekly).
2. **Wire APNs into `send-mention-notification**` — replace the TODO with actual `send-apns-notification` call (same pattern as `send-reaction-notification`).
3. **Add APNs to `check-inactivity-notifications**` — currently web-push only.

### Phase 2: New high-value notifications

4. **"Start Your Day" nudge** — New edge function `check-start-day-reminders`, runs every 15 min. Checks `planned_work_days` for today + whether `daily_entries` has a `work_start_time`. Sends at noon local.
5. **Personal record celebration** — Hook into existing `check-personal-records` function to send a push when a new PR is detected.
6. **Challenge progress updates** — New edge function `check-challenge-progress`, runs daily at 6pm local. Compares participants' current metrics and sends competitive nudges.

### Technical Notes

- All new scheduled functions need both `pg_cron` entries AND the function code.
- All new notifications must send to both web push (`push_subscriptions`) and APNs (`apns_device_tokens` via `send-apns-notification`).
- All notifications must log to `notification_logs` with deduplication checks.
- Timezone-awareness is critical — use the pattern from `check-task-reminders` with `getLocalHour()`.