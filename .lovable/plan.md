# Notification System – Implementation Plan

## Completed

### Phase 1: Core Notification Pipeline
- 21 notification types (web push + APNs)
- Timezone-aware cron-based nudges
- Deduplication via notification_logs
- In-app foreground banner (InAppNotificationBanner.tsx)

### Phase 2: iOS Rich Notifications (Press & Hold)
- **Swift files created** in `ios-notification-setup/`:
  - `NotificationCategories.swift` — 23 categories with contextual actions
  - `NotificationResponseHandler.swift` — Handles all action responses including inline replies, call/text, snooze, RSVP
  - `README.md` — Step-by-step setup guide
- **`handle-notification-reply` edge function** — Receives inline replies from iOS, saves as comments, triggers comment notifications
- **APNs payload enriched** — Now passes `activityId`, `recruitId`, `recruitName`, `phone`, `challengeId`, `repUserId` through to iOS `userInfo`

### User Notes on Specific Notifications
- **task_past_due**: Actions = View Tasks, Reschedule (navigate to tasks page)
- **preseason_accountability**: Just a reminder of commitments, not a logging action
- **access_request**: Should track onboarding flow progression (3 levels up upline), not just signup
- **install_reminder_eve**: "View Sale" opens to that customer in CRM
- **install_reminder_due**: "Installed" confirms, "Update" for canceled/rescheduled
- **personal_record**: Need to determine what view/page to show
- **leader_coaching**: Call/Text the struggling rep + need a coaching view/page
- **challenge_progress**: "View" opens that specific challenge

## TODO
- [ ] Enrich all notification callers to pass `activityId`, `recruitId`, `phone`, etc. to APNs
- [ ] Build coaching view page for leader_coaching deep link
- [ ] Build personal record celebration view
- [ ] Build task reschedule flow for task_past_due
- [ ] Add install status update flow for install_reminder_due
- [ ] Onboarding progression notifications (3 levels up approval flow)
