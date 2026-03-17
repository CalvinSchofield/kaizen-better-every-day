# iOS Rich Notification Setup — Step by Step

## What This Does
Adds press-and-hold interactive actions to all 21 notification types:
- **Inline Reply** on comments & mentions (like iMessage)
- **Call / Text** on task reminders & coaching nudges
- **RSVP** on blitz trips
- **Save My Day / Still Working** on inactivity nudges
- **Snooze 1hr** on task reminders
- And more...

## Setup Steps

### Step 1: Copy Files into Xcode

Copy these two Swift files into your Xcode project's `App/` directory (next to `AppDelegate.swift`):
- `NotificationCategories.swift`
- `NotificationResponseHandler.swift`

### Step 2: Update AppDelegate.swift

Your `AppDelegate.swift` should already have push notification registration from Capacitor. Add these lines:

```swift
import UserNotifications  // Add at top if not already there

// In application(_:didFinishLaunchingWithOptions:), ADD this line
// BEFORE the return statement:
registerNotificationCategories()

// Make sure you have this line too:
UNUserNotificationCenter.current().delegate = self
```

**Important:** If your AppDelegate already conforms to `UNUserNotificationCenterDelegate`, 
remove that conformance from AppDelegate and let `NotificationResponseHandler.swift` handle it 
(it adds the conformance via extension).

### Step 3: Build & Test

1. `npx cap sync ios`
2. Open in Xcode, build to your device
3. Send a test notification (use the test button in the app)
4. Lock your phone, wait for the notification banner
5. **Press and hold** the notification — you should see action buttons!
6. For **comment/mention** types, you'll see a "Reply" button with a text field

### Step 4: Deploy the Reply Handler

The `handle-notification-reply` edge function (created automatically in Lovable) 
receives inline replies and saves them as comments. No additional setup needed.

## How the Data Flows

```
User press-and-holds notification
  → Sees action buttons (defined in NotificationCategories.swift)
  → Taps "Reply" and types text
  → NotificationResponseHandler.swift fires
  → Sends POST to handle-notification-reply edge function
  → Edge function saves comment to recruit_activity_comments
  → Other users get notified of the new comment
```

## Custom Data in APNs Payloads

The backend already sends these fields in each notification. The Swift code
reads them from `userInfo` to know what to do:

| Field | Example | Used For |
|-------|---------|----------|
| `type` | `"comment"` | Which category triggered |
| `url` | `"/recruits/abc123"` | Deep link when user taps "View" |
| `activityId` | `"uuid..."` | For inline replies — which activity to reply to |
| `recruitId` | `"uuid..."` | For navigation to specific recruit |
| `recruitName` | `"David Johnson"` | Display context |
| `phone` | `"801-555-1234"` | For Call/Text actions |
| `challengeId` | `"uuid..."` | For challenge deep links |
| `repUserId` | `"uuid..."` | For coaching nudge — which rep needs help |

## Notification Types Quick Reference

| Category | Actions on Press & Hold |
|----------|------------------------|
| `comment` | **Reply** (text input), View |
| `mention` | **Reply** (text input), View |
| `reaction` | 🔥 React Back, **Reply**, View |
| `task_assignment` | ✅ Done, View |
| `task_single_reminder` | 📞 Call, 💬 Text, ⏰ Snooze 1hr |
| `task_morning_digest` | View, Dismiss |
| `task_evening_nudge` | View, Dismiss |
| `task_past_due` | View, 📅 Reschedule |
| `inactivity_save` | 💾 Save My Day, ⏳ Still Working |
| `inactivity_motivate` | 🚀 Go, Dismiss |
| `blitz_rsvp_first/second` | ✅ I'm In!, ❌ Can't Make It |
| `preseason_accountability` | View, Dismiss |
| `ramp_progress` | View, Dismiss |
| `access_request` | 👀 Check Progress, View |
| `install_reminder_eve` | 💬 Text Customer, View |
| `install_reminder_due` | ✅ Installed, 📝 Update |
| `personal_record` | View, Dismiss |
| `start_day` | 🚀 Go, Dismiss |
| `leader_coaching_nudge` | 📞 Call, 💬 Text, View |
| `challenge_progress` | View, Dismiss |
| `onboarding_completion` | 👀 Check Progress, View |
