# All Notification Types & Rich Action Possibilities

## Current Notifications Built


| #   | Type                         | Trigger                                | Current Title Example               | Current Actions (Web SW)                                                                                                                                                                                                                        |
| --- | ---------------------------- | -------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **comment**                  | Someone comments on a recruit activity | "💬 New Comment on David Johnson"   | Reply, View                                                                                                                                                                                                                                     |
| 2   | **mention**                  | Someone @mentions you in a comment     | "🔔 Mentioned on David Johnson"     | Reply, View                                                                                                                                                                                                                                     |
| 3   | **reaction**                 | Someone reacts to your activity        | "🔥 Reaction on David Johnson"      | Reply, View                                                                                                                                                                                                                                     |
| 4   | **task_assignment**          | You're assigned a task                 | "📋 Task: David Johnson"            | Add to Calendar, View Task                                                                                                                                                                                                                      |
| 5   | **task_single_reminder**     | Reminder for a specific task           | "⏰ Reminder: Call David Johnson"    | Call, Text                                                                                                                                                                                                                                      |
| 6   | **task_morning_digest**      | 9am daily task summary                 | "📋 Today's Tasks"                  | View Tasks, Dismiss                                                                                                                                                                                                                             |
| 7   | **task_evening_nudge**       | 6pm incomplete tasks                   | "📋 Unfinished Tasks"               | View Tasks, Dismiss                                                                                                                                                                                                                             |
| 8   | **task_past_due**            | 9pm overdue tasks                      | "📋 Overdue Tasks"                  | View Tasks, Reschedule (gotta build this out or nvaigate to page)                                                                                                                                                                               |
| 9   | **inactivity_save**          | 60min idle or 9pm save prompt          | "🌙 Save Your Day?"                 | Save My Day, Still Working                                                                                                                                                                                                                      |
| 10  | **inactivity_motivate**      | Idle motivational nudge                | "🚪 Back to Doors"                  | Back to Doors, Got It                                                                                                                                                                                                                           |
| 11  | **blitz_rsvp_first/second**  | Blitz trip RSVP reminder               | "🔥 Blitz Trip: Salt Lake City"     | I'm In!, View Details                                                                                                                                                                                                                           |
| 12  | **preseason_accountability** | Pre-season goal check-in               | "📊 Log Progress"                   | Log Progress, Later (not sure about logging progress as i think we are kinda just reminding them what they said they'd do, not really logging it here anymore on the app)                                                                       |
| 13  | **ramp_progress**            | Rookie ramp milestone                  | "👀 View Rookie"                    | View Rookie, Got It                                                                                                                                                                                                                             |
| 14  | **access_request**           | New rep signs up                       | "👋 New Rep: David Johnson"         | Check Progress, Approve (this i was thinking of progressing on the onbaording flow and notifiying 3 levels up their upline to get it approved and moved, not just when someone signs up. But rather when they say "done with joining the slack) |
| 15  | **install_reminder_eve**     | Install tomorrow reminder              | "📅 Install Tomorrow: Smith Family" | Text Customer, View Sale (opens to that customer in CRM)                                                                                                                                                                                        |
| 16  | **install_reminder_due**     | Install day-of reminder                | "✅ Confirm / Update"                | Installed, Update (change to canceled, new install time, etc)                                                                                                                                                                                   |
| 17  | **personal_record**          | Rep breaks a personal record           | "🏆 New Record!"                    | View, Got It (what do we show them? how do we have them view this?)                                                                                                                                                                             |
| 18  | **start_day**                | Noon nudge if haven't started          | "☀️ Start Your Day"                 | Go (opens /track), Got it                                                                                                                                                                                                                       |
| 19  | **leader_coaching**          | Rep has 2+ days no sale                | "📋 Coaching Needed"                | Call, Text (what do we show here? waht page are they viewing if they click on this?)                                                                                                                                                            |
| 20  | **challenge_progress**       | 6pm challenge standings                | "🏆 Challenge Update"               | View (opens that specific challenge), Dismiss                                                                                                                                                                                                   |
| 21  | **onboarding_completion**    | Rookie completes onboarding step       | "✅ Onboarding Complete"             | View, Got It                                                                                                                                                                                                                                    |


---

## What iOS Rich Notifications Can Do (Press & Hold)

When you press and hold a notification on iOS, Apple supports these **interactive styles**:

1. **Action Buttons** (what we have via web SW) -- 2-4 buttons like "Reply", "View", "Call"
2. **Text Input Action** -- A text field appears right in the notification (like iMessage reply). User types and sends without opening the app.
3. **Destructive Actions** -- Red-colored buttons for "Delete", "Decline", etc.
4. **Custom UI (Notification Content Extension)** -- A full mini-view inside the notification (like seeing a photo, map, or media player). This requires a separate Xcode target.

**What's realistic without a native Xcode extension:**

- Action buttons (already working via `category` in APNs payload)
- Text input replies (requires Swift code in AppDelegate)

**What requires an Xcode Notification Content Extension (more work):**

- Custom expanded UI (showing recruit photo, activity details, inline reactions)

---

## Recommended Press & Hold Actions Per Notification


| Notification             | Press & Hold Actions                | Why                                            |
| ------------------------ | ----------------------------------- | ---------------------------------------------- |
| **comment**              | **Inline Reply** (text input), View | Reply directly from notification like iMessage |
| **mention**              | **Inline Reply** (text input), View | Same — respond to the @mention immediately     |
| **reaction**             | 🔥 React Back, 💬 Reply, View       | Quick react or reply                           |
| **task_assignment**      | Mark Complete, View Task            | Handle it without opening app                  |
| **task_single_reminder** | 📞 Call, 💬 Text, Snooze 1hr        | Direct contact actions                         |
| **inactivity_save**      | 💾 Save My Day, ⏳ Still Working     | Already good                                   |
| **blitz_rsvp**           | ✅ I'm In!, ❌ Can't Make It          | Clear RSVP actions                             |
| **install_reminder**     | 💬 Text Customer, 📞 Call Customer  | Direct contact                                 |
| **access_request**       | ✅ Approve, 👀 View Profile          | Quick approval flow                            |


---

## Step-by-Step: How to Add Rich Actions on iOS

This requires **Swift code changes in your Xcode project** (not Lovable). Here's the simple walkthrough:

### Step 1: Register Notification Categories in AppDelegate.swift

In your iOS project's `AppDelegate.swift`, you register "categories" that match the `category` field we already send in APNs payloads. Each category defines what buttons appear on press-and-hold.

```swift
// In AppDelegate.swift, inside application(_:didFinishLaunchingWithOptions:)

import UserNotifications

// Define categories with actions
let replyAction = UNTextInputNotificationAction(
    identifier: "reply",
    title: "Reply",
    options: [.authenticationRequired],
    textInputButtonTitle: "Send",
    textInputPlaceholder: "Type a reply..."
)
let viewAction = UNNotificationAction(identifier: "view", title: "View", options: [.foreground])
let callAction = UNNotificationAction(identifier: "call", title: "📞 Call", options: [.foreground])
let textAction = UNNotificationAction(identifier: "text", title: "💬 Text", options: [.foreground])
let markCompleteAction = UNNotificationAction(identifier: "complete", title: "✅ Done", options: [])
let approveAction = UNNotificationAction(identifier: "approve", title: "✅ Approve", options: [.foreground])

// Map categories to actions
let commentCategory = UNNotificationCategory(identifier: "comment", actions: [replyAction, viewAction], ...)
let mentionCategory = UNNotificationCategory(identifier: "mention", actions: [replyAction, viewAction], ...)
let taskCategory = UNNotificationCategory(identifier: "task_single_reminder", actions: [callAction, textAction], ...)
let accessCategory = UNNotificationCategory(identifier: "access_request", actions: [approveAction, viewAction], ...)

UNUserNotificationCenter.current().setNotificationCategories([
    commentCategory, mentionCategory, taskCategory, accessCategory, ...
])
```

### Step 2: Handle Action Responses

In the same `AppDelegate.swift`, implement the delegate method that fires when a user taps an action:

```swift
func userNotificationCenter(_ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void) {

    let action = response.actionIdentifier
    let userInfo = response.notification.request.content.userInfo

    if action == "reply", let textResponse = response as? UNTextInputNotificationResponse {
        // Send the reply text to your backend
        let replyText = textResponse.userText
        let activityId = userInfo["activityId"] as? String
        // POST to edge function to save comment
    }

    completionHandler()
}
```

### Step 3: Create an Edge Function to Handle Inline Replies

When a user replies from a notification, the Swift code sends the text to a new edge function like `handle-notification-reply` which saves it as a comment.

### Step 4: The APNs Payload Already Works

Our `send-apns-notification` already sends a `category` field in the APNs payload that matches these identifiers. No backend changes needed for basic action buttons.

---

## Summary

- **Action buttons** (Call, Text, View, Approve) -- Only needs Swift changes in `AppDelegate.swift`. Our backend already sends the right `category` values.
- **Inline text reply** (like iMessage) -- Needs Swift `UNTextInputNotificationAction` + a new edge function to receive the reply.
- **Custom expanded UI** (showing photos, maps) -- Needs a Notification Content Extension in Xcode. More complex, recommend as a later phase.

The first two are straightforward. Want me to write out the exact `AppDelegate.swift` code and the reply-handling edge function?  
  
YES write it out but make sure you take into consideration my changes and suggestions

&nbsp;