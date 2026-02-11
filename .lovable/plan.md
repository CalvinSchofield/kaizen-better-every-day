

# Notification System Fine-Tuning: Deep Links, Press-and-Hold Actions, and Interactive Responses

## Overview

This plan upgrades the notification system from simple "view/dismiss" buttons to rich, context-aware interactions that mirror what top-tier mobile apps offer. The three pillars are:

1. **Richer notification payloads** -- pass more data (recruit phone, activity ID, recruit ID, etc.) so the service worker can power interactive actions
2. **Press-and-hold / action buttons** -- platform-appropriate quick actions for each notification type
3. **Deep linking** -- every notification navigates directly to the right place in the app

---

## Notification Types and Their Interactions

### 1. Reaction Notification (Someone likes your activity)
- **Deep link**: `/my-group?recruitId=X&activityId=Y&openComments=true` (opens recruit, scrolls to activity, opens comment drawer)
- **Actions**:
  - "Reply" -- opens the app to the comment drawer for that activity, ready to type
  - "View" -- navigates to the activity

### 2. Mention Notification (Someone @mentions you)
- **Deep link**: `/my-group?recruitId=X&activityId=Y&openComments=true`
- **Actions**:
  - "Reply" -- same as reaction, opens comment input pre-focused
  - "View" -- navigates to the activity

### 3. Comment Notification (NEW -- someone comments on your activity)
- A notification is currently missing for when someone comments on your activity (not just @mentions). This will be added.
- **Deep link**: `/my-group?recruitId=X&activityId=Y&openComments=true`
- **Actions**:
  - "Reply" -- opens comment drawer
  - "View" -- navigates to activity

### 4. Task Assignment Notification
- **Deep link**: `/my-group?recruitId=X` (already works)
- **Actions**:
  - "Add to Calendar" -- navigates to `/my-group?recruitId=X&addToCalendar=ACTIVITY_ID`
  - "View Task" -- navigates to the recruit detail

### 5. Task Reminder (Morning Digest / Evening Nudge / Past Due)
- **Deep link**: `/my-group?openPlanner=true` (opens the week planner view)
- **Actions for single-task reminders**:
  - "Call" -- `tel:` link using recruit phone from payload
  - "Text" -- `sms:` link using recruit phone
  - "Complete" -- navigates to `/my-group?recruitId=X&completeActivity=ACTIVITY_ID`
- **Actions for digest (multi-task)**:
  - "View Tasks" -- opens planner
  - "Dismiss"

---

## Technical Changes

### A. Service Worker (`public/sw-custom.js`)

Rewrite `getNotificationActions()` to support the new notification types and add richer action handling in `notificationclick`:

- **New action types**: `reply`, `add_to_calendar`, `call`, `text`, `complete`
- **`call` and `text` actions**: Use `clients.openWindow('tel:...')` or `clients.openWindow('sms:...')` directly from the service worker -- phone number will be in the notification data payload
- **`reply` action**: Navigate to the deep link URL with `&openComments=true` appended
- **`add_to_calendar` action**: Navigate with `&addToCalendar=ACTIVITY_ID` query param
- **`complete` action**: Navigate with `&completeActivity=ACTIVITY_ID` query param

### B. Edge Function Payloads -- Enrich Data

**`send-reaction-notification`**:
- Add `recruit_phone` to the push payload so the service worker has context
- Add `activityId` and `recruitId` to the `data` field
- Change deep link to include `&openComments=true`

**`send-mention-notification`**:
- Add `openComments=true` to deep link URL
- Pass `activityId` in the data payload

**`send-task-assignment-notification`**:
- Add `activityId` (the newly created activity) to the payload so "Add to Calendar" can work
- Add `recruitName` and `nextActionDue` to the data field

**`check-task-reminders`**:
- For single-task notifications, include `recruitId`, `activityId`, and `recruitPhone` in the payload
- Deep link to recruit page instead of generic `/my-group`
- For multi-task digests, deep link to `/my-group?openPlanner=true`

### C. New Edge Function: `send-comment-notification`

When someone comments on an activity you logged (and it's not a self-comment), send a push notification. This fills a gap -- currently only @mentions trigger notifications, not regular comments.

- Triggered from the `useAddComment` mutation in `useActivitySocial.ts`
- Looks up the activity's `logged_by_user_id` and sends them a notification
- Skips if the commenter IS the activity logger
- Skips if the user is already being mentioned (to avoid double-notifying)
- Payload: `{ title: "Name commented on your activity", body: "preview...", url: deepLink, type: "comment" }`

### D. App-Side Deep Link Handling (`src/pages/MyGroup.tsx`)

Extend the existing deep link handler to support new query parameters:

- `openComments=true` -- after opening the recruit detail drawer, auto-open the comment drawer for the specified `activityId`
- `addToCalendar=ACTIVITY_ID` -- after opening the recruit detail, trigger the "Add to Calendar" prompt for that activity
- `completeActivity=ACTIVITY_ID` -- after opening the recruit detail, trigger the mark-complete flow for that activity
- `openPlanner=true` -- switch to the week planner view

### E. Comment Reply Notification Loop

When User A's activity gets a reaction/mention/comment from User B, and User A replies via the notification (which adds a comment), that comment in turn triggers a notification back to User B. This creates the natural back-and-forth conversation loop driven entirely from notifications.

The existing `useAddComment` hook already handles mention notifications. The new `send-comment-notification` function completes the loop for non-mention replies.

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/send-comment-notification/index.ts` | Push notification when someone comments on your activity |

## Files to Modify

| File | Changes |
|------|---------|
| `public/sw-custom.js` | New action types, richer click handling, call/text actions |
| `supabase/functions/send-reaction-notification/index.ts` | Enrich payload with recruitPhone, add openComments to URL |
| `supabase/functions/send-mention-notification/index.ts` | Add openComments to URL, pass activityId in data |
| `supabase/functions/send-task-assignment-notification/index.ts` | Add activityId to payload for calendar integration |
| `supabase/functions/check-task-reminders/index.ts` | Include recruit phone and IDs for single-task reminders |
| `src/hooks/useActivitySocial.ts` | Trigger `send-comment-notification` from `useAddComment` |
| `src/pages/MyGroup.tsx` | Handle `openComments`, `addToCalendar`, `completeActivity`, `openPlanner` query params |
| `supabase/config.toml` | Register `send-comment-notification` function |

---

## Implementation Order

1. Create `send-comment-notification` edge function
2. Update all existing edge function payloads (reaction, mention, task assignment, task reminders) with richer data
3. Rewrite service worker actions and click handling
4. Update `useAddComment` to trigger comment notifications
5. Extend MyGroup deep link handler for new query params
6. Register new function in config.toml

