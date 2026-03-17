// =============================================================================
// NOTIFICATION CATEGORIES — Copy this into your AppDelegate.swift
// =============================================================================
//
// This file defines all notification categories and their press-and-hold actions
// for the Kaizen iOS app. Add this code to your existing AppDelegate.swift.
//
// REQUIREMENTS:
//   import UserNotifications
//   Set UNUserNotificationCenter.current().delegate = self
//
// =============================================================================

import UserNotifications
import Capacitor

// MARK: - Register Notification Categories
// Call this from application(_:didFinishLaunchingWithOptions:) BEFORE returning

func registerNotificationCategories() {
    
    // ── Shared Actions ──────────────────────────────────────────────────
    
    let replyAction = UNTextInputNotificationAction(
        identifier: "reply",
        title: "Reply",
        options: [.authenticationRequired],
        textInputButtonTitle: "Send",
        textInputPlaceholder: "Type a reply..."
    )
    
    let viewAction = UNNotificationAction(
        identifier: "view",
        title: "View",
        options: [.foreground]
    )
    
    let dismissAction = UNNotificationAction(
        identifier: "dismiss",
        title: "Dismiss",
        options: [.destructive]
    )
    
    let callAction = UNNotificationAction(
        identifier: "call",
        title: "📞 Call",
        options: [.foreground]
    )
    
    let textAction = UNNotificationAction(
        identifier: "text",
        title: "💬 Text",
        options: [.foreground]
    )
    
    // ── Category-Specific Actions ───────────────────────────────────────
    
    let saveMyDayAction = UNNotificationAction(
        identifier: "save_my_day",
        title: "💾 Save My Day",
        options: [.foreground]
    )
    
    let stillWorkingAction = UNNotificationAction(
        identifier: "still_working",
        title: "⏳ Still Working",
        options: []
    )
    
    let goAction = UNNotificationAction(
        identifier: "go",
        title: "🚀 Go",
        options: [.foreground]
    )
    
    let imInAction = UNNotificationAction(
        identifier: "rsvp_yes",
        title: "✅ I'm In!",
        options: []
    )
    
    let cantMakeItAction = UNNotificationAction(
        identifier: "rsvp_no",
        title: "❌ Can't Make It",
        options: [.destructive]
    )
    
    let markCompleteAction = UNNotificationAction(
        identifier: "complete",
        title: "✅ Done",
        options: []
    )
    
    let snoozeAction = UNNotificationAction(
        identifier: "snooze_1hr",
        title: "⏰ Snooze 1hr",
        options: []
    )
    
    let rescheduleAction = UNNotificationAction(
        identifier: "reschedule",
        title: "📅 Reschedule",
        options: [.foreground]
    )
    
    let textCustomerAction = UNNotificationAction(
        identifier: "text_customer",
        title: "💬 Text Customer",
        options: [.foreground]
    )
    
    let installedAction = UNNotificationAction(
        identifier: "installed",
        title: "✅ Installed",
        options: []
    )
    
    let updateStatusAction = UNNotificationAction(
        identifier: "update_status",
        title: "📝 Update",
        options: [.foreground]
    )
    
    let checkProgressAction = UNNotificationAction(
        identifier: "check_progress",
        title: "👀 Check Progress",
        options: [.foreground]
    )
    
    let reactBackAction = UNNotificationAction(
        identifier: "react_back",
        title: "🔥 React Back",
        options: []
    )
    
    // ── Categories (match APNs payload "category" field) ────────────────
    
    // 1. comment — Inline reply + View
    let commentCategory = UNNotificationCategory(
        identifier: "comment",
        actions: [replyAction, viewAction],
        intentIdentifiers: [],
        options: []
    )
    
    // 2. mention — Inline reply + View
    let mentionCategory = UNNotificationCategory(
        identifier: "mention",
        actions: [replyAction, viewAction],
        intentIdentifiers: [],
        options: []
    )
    
    // 3. reaction — React Back, Reply, View
    let reactionCategory = UNNotificationCategory(
        identifier: "reaction",
        actions: [reactBackAction, replyAction, viewAction],
        intentIdentifiers: [],
        options: []
    )
    
    // 4. task_assignment — Mark Complete, View Task
    let taskAssignmentCategory = UNNotificationCategory(
        identifier: "task_assignment",
        actions: [markCompleteAction, viewAction],
        intentIdentifiers: [],
        options: []
    )
    
    // 5. task_single_reminder — Call, Text, Snooze
    let taskReminderCategory = UNNotificationCategory(
        identifier: "task_single_reminder",
        actions: [callAction, textAction, snoozeAction],
        intentIdentifiers: [],
        options: []
    )
    
    // 6. task_morning_digest — View Tasks, Dismiss
    let taskMorningCategory = UNNotificationCategory(
        identifier: "task_morning_digest",
        actions: [viewAction, dismissAction],
        intentIdentifiers: [],
        options: []
    )
    
    // 7. task_evening_nudge — View Tasks, Dismiss
    let taskEveningCategory = UNNotificationCategory(
        identifier: "task_evening_nudge",
        actions: [viewAction, dismissAction],
        intentIdentifiers: [],
        options: []
    )
    
    // 8. task_past_due — View Tasks, Reschedule
    let taskPastDueCategory = UNNotificationCategory(
        identifier: "task_past_due",
        actions: [viewAction, rescheduleAction],
        intentIdentifiers: [],
        options: []
    )
    
    // 9. inactivity_save — Save My Day, Still Working
    let inactivitySaveCategory = UNNotificationCategory(
        identifier: "inactivity_save",
        actions: [saveMyDayAction, stillWorkingAction],
        intentIdentifiers: [],
        options: []
    )
    
    // 10. inactivity_motivate — Go, Dismiss
    let inactivityMotivateCategory = UNNotificationCategory(
        identifier: "inactivity_motivate",
        actions: [goAction, dismissAction],
        intentIdentifiers: [],
        options: []
    )
    
    // 11. blitz_rsvp — I'm In!, Can't Make It
    let blitzRsvpFirstCategory = UNNotificationCategory(
        identifier: "blitz_rsvp_first",
        actions: [imInAction, cantMakeItAction],
        intentIdentifiers: [],
        options: []
    )
    let blitzRsvpSecondCategory = UNNotificationCategory(
        identifier: "blitz_rsvp_second",
        actions: [imInAction, cantMakeItAction],
        intentIdentifiers: [],
        options: []
    )
    
    // 12. preseason_accountability — View, Dismiss
    let preseasonCategory = UNNotificationCategory(
        identifier: "preseason_accountability",
        actions: [viewAction, dismissAction],
        intentIdentifiers: [],
        options: []
    )
    
    // 13. ramp_progress — View Rookie, Dismiss
    let rampProgressCategory = UNNotificationCategory(
        identifier: "ramp_progress",
        actions: [viewAction, dismissAction],
        intentIdentifiers: [],
        options: []
    )
    
    // 14. access_request — Check Progress, View
    let accessRequestCategory = UNNotificationCategory(
        identifier: "access_request",
        actions: [checkProgressAction, viewAction],
        intentIdentifiers: [],
        options: []
    )
    
    // 15. install_reminder_eve — Text Customer, View Sale
    let installEveCategory = UNNotificationCategory(
        identifier: "install_reminder_eve",
        actions: [textCustomerAction, viewAction],
        intentIdentifiers: [],
        options: []
    )
    
    // 16. install_reminder_due — Installed, Update
    let installDueCategory = UNNotificationCategory(
        identifier: "install_reminder_due",
        actions: [installedAction, updateStatusAction],
        intentIdentifiers: [],
        options: []
    )
    
    // 17. personal_record — View, Dismiss
    let personalRecordCategory = UNNotificationCategory(
        identifier: "personal_record",
        actions: [viewAction, dismissAction],
        intentIdentifiers: [],
        options: []
    )
    
    // 18. start_day — Go, Dismiss
    let startDayCategory = UNNotificationCategory(
        identifier: "start_day",
        actions: [goAction, dismissAction],
        intentIdentifiers: [],
        options: []
    )
    
    // 19. leader_coaching — Call, Text
    let leaderCoachingCategory = UNNotificationCategory(
        identifier: "leader_coaching_nudge",
        actions: [callAction, textAction, viewAction],
        intentIdentifiers: [],
        options: []
    )
    
    // 20. challenge_progress — View, Dismiss
    let challengeProgressCategory = UNNotificationCategory(
        identifier: "challenge_progress",
        actions: [viewAction, dismissAction],
        intentIdentifiers: [],
        options: []
    )
    
    // 21. onboarding_completion — Check Progress, View
    let onboardingCategory = UNNotificationCategory(
        identifier: "onboarding_completion",
        actions: [checkProgressAction, viewAction],
        intentIdentifiers: [],
        options: []
    )
    
    // Default fallback
    let defaultCategory = UNNotificationCategory(
        identifier: "default",
        actions: [viewAction, dismissAction],
        intentIdentifiers: [],
        options: []
    )
    
    // ── Register All ────────────────────────────────────────────────────
    
    UNUserNotificationCenter.current().setNotificationCategories([
        commentCategory,
        mentionCategory,
        reactionCategory,
        taskAssignmentCategory,
        taskReminderCategory,
        taskMorningCategory,
        taskEveningCategory,
        taskPastDueCategory,
        inactivitySaveCategory,
        inactivityMotivateCategory,
        blitzRsvpFirstCategory,
        blitzRsvpSecondCategory,
        preseasonCategory,
        rampProgressCategory,
        accessRequestCategory,
        installEveCategory,
        installDueCategory,
        personalRecordCategory,
        startDayCategory,
        leaderCoachingCategory,
        challengeProgressCategory,
        onboardingCategory,
        defaultCategory,
    ])
    
    print("[Kaizen] Registered \(23) notification categories")
}
