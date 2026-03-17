

## Notification Test Harness

Right now, the `test-push-notification` edge function only sends a single generic `test_rich` notification. To properly test deep links, action buttons (Reply, Call, Text, Add to Calendar, etc.), you need a way to fire each notification type on demand.

### What we'll build

A **debug-only test page** (e.g. `/debug-notifications`) with buttons that each fire a realistic notification of a specific type. The existing `test-push-notification` edge function will be upgraded to accept a `type` parameter and send the correct payload for that type.

### Notification types worth testing (richest action buttons + deep links)

| Type | Actions | Deep Link | Why it's useful |
|------|---------|-----------|-----------------|
| `comment` | 💬 Reply, 👀 View | `/my-group?recruitId=X&activityId=Y&openComments=true` | Tests reply flow + comment deep link |
| `mention` | 💬 Reply, 👀 View | Same deep link pattern | Tests @mention path |
| `task_assignment` | 📅 Add to Calendar, 👀 View Task | `/my-group?recruitId=X`