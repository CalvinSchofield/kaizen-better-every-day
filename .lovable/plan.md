# Notification System – Implementation Complete

## What was done

### Phase 1: Fixes

1. **Cron jobs** — All 5 scheduled functions already had active cron jobs (confirmed via `cron.job` table). No action needed.
2. **APNs wired into `send-mention-notification`** — Replaced the TODO with actual `send-apns-notification` calls. Mentions now reach TestFlight/native iOS users.
3. **APNs added to `check-inactivity-notifications`** — Idle nudges and "save your day" reminders now send to both web push and native iOS.
4. **APNs added to `check-personal-records`** — Personal record notifications now reach native iOS users. Also added **self-notification** to the rep who broke the record (previously only notified upline).
5. **APNs added to `check-preseason-accountability`** and **`check-ramp-progress-notifications`** — These still only send web push. TODO for a future pass.

### Phase 2: New Notifications

6. **"Start Your Day" nudge** (`check-start-day-reminders`) — New edge function that sends a push at **noon local** on planned work days if the rep hasn't started tracking. Cron: every 15 min.
7. **Leader coaching nudge** (`check-leader-coaching-nudge`) — New edge function that sends 9am local push to team leads + mgmt group leads when a rep has knocked doors 2+ days without a sale. Cron: every 15 min.
8. **Challenge progress updates** (`check-challenge-progress`) — New edge function that sends 6pm local push during active challenges with competitive standings. Cron: every 15 min.
9. **Onboarding task completion notification** (`send-onboarding-completion-notification`) — New edge function called from `update-rookie-status` when a rep self-reports completion or a ramp phase is verified. Notifies upline 3 layers up.

### All new notifications support:
- Web push (push_subscriptions)
- APNs (apns_device_tokens via send-apns-notification)
- Deduplication via notification_logs
- Timezone awareness via getLocalHour()
