// =============================================================================
// NOTIFICATION RESPONSE HANDLER — Add this to your AppDelegate.swift
// =============================================================================
//
// This extension handles what happens when the user taps an action button
// on a press-and-hold notification (or taps the notification itself).
//
// Add UNUserNotificationCenterDelegate to your AppDelegate class declaration:
//   class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate
//
// And in didFinishLaunchingWithOptions:
//   UNUserNotificationCenter.current().delegate = self
//   registerNotificationCategories()  // from NotificationCategories.swift
//
// =============================================================================

import Foundation
import UserNotifications
import UIKit

// MARK: - Notification Response Handling

extension AppDelegate: UNUserNotificationCenterDelegate {
    
    /// Called when user taps a notification action (press-and-hold buttons)
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let actionId = response.actionIdentifier
        let userInfo = response.notification.request.content.userInfo
        
        // Extract custom data from APNs payload
        let notificationType = userInfo["type"] as? String ?? "default"
        let deepLinkUrl = userInfo["url"] as? String ?? "/"
        let activityId = userInfo["activityId"] as? String
        let recruitId = userInfo["recruitId"] as? String
        let recruitName = userInfo["recruitName"] as? String
        let phone = userInfo["phone"] as? String
        let challengeId = userInfo["challengeId"] as? String
        let repUserId = userInfo["repUserId"] as? String
        
        print("[Kaizen] Action: \(actionId) | Type: \(notificationType) | URL: \(deepLinkUrl)")
        
        switch actionId {
            
        // ── INLINE REPLY (iMessage-style) ───────────────────────────────
        case "reply":
            if let textResponse = response as? UNTextInputNotificationResponse {
                let replyText = textResponse.userText
                print("[Kaizen] Reply text: \(replyText)")
                
                // Send to backend edge function
                sendNotificationReply(
                    activityId: activityId,
                    recruitId: recruitId,
                    replyText: replyText,
                    notificationType: notificationType
                )
            }
            
        // ── REACT BACK (🔥) ────────────────────────────────────────────
        case "react_back":
            if let actId = activityId {
                sendReactBack(activityId: actId)
            }
            
        // ── CALL / TEXT ─────────────────────────────────────────────────
        case "call":
            if let phoneNumber = phone {
                let cleaned = phoneNumber.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
                if let url = URL(string: "tel://\(cleaned)") {
                    DispatchQueue.main.async { UIApplication.shared.open(url) }
                }
            } else if let repId = repUserId {
                // Navigate to rep profile to find phone
                navigateInApp(to: "/recruits?highlight=\(repId)")
            }
            
        case "text", "text_customer":
            if let phoneNumber = phone {
                let cleaned = phoneNumber.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
                if let url = URL(string: "sms://\(cleaned)") {
                    DispatchQueue.main.async { UIApplication.shared.open(url) }
                }
            }
            
        // ── TASK ACTIONS ────────────────────────────────────────────────
        case "complete":
            // Mark task complete via edge function (future: build this)
            print("[Kaizen] Mark complete requested for task")
            navigateInApp(to: deepLinkUrl)
            
        case "snooze_1hr":
            // Reschedule local notification 1hr from now
            rescheduleNotification(
                from: response.notification.request,
                delayMinutes: 60
            )
            
        case "reschedule":
            // Open task page to reschedule
            navigateInApp(to: "/tasks")
            
        // ── INACTIVITY ──────────────────────────────────────────────────
        case "save_my_day":
            navigateInApp(to: "/track?action=save")
            
        case "still_working":
            // Just dismiss — they're still working
            print("[Kaizen] User is still working, dismissing")
            
        // ── BLITZ RSVP ─────────────────────────────────────────────────
        case "rsvp_yes":
            print("[Kaizen] RSVP Yes")
            navigateInApp(to: deepLinkUrl)
            
        case "rsvp_no":
            print("[Kaizen] RSVP No (declined)")
            // Could call an edge function to record decline
            
        // ── INSTALL REMINDER ────────────────────────────────────────────
        case "installed":
            print("[Kaizen] Marked as installed")
            // Future: call edge function to update install status
            
        case "update_status":
            navigateInApp(to: deepLinkUrl)
            
        // ── ONBOARDING / ACCESS REQUEST ─────────────────────────────────
        case "check_progress":
            if let rId = recruitId {
                navigateInApp(to: "/recruits/\(rId)")
            } else {
                navigateInApp(to: deepLinkUrl)
            }
            
        // ── GO (Start Day) ─────────────────────────────────────────────
        case "go":
            navigateInApp(to: "/track")
            
        // ── VIEW (generic) or default tap ───────────────────────────────
        case "view", UNNotificationDefaultActionIdentifier:
            navigateInApp(to: deepLinkUrl)
            
        // ── DISMISS ─────────────────────────────────────────────────────
        case "dismiss", UNNotificationDismissActionIdentifier:
            print("[Kaizen] Notification dismissed")
            
        default:
            print("[Kaizen] Unknown action: \(actionId)")
            navigateInApp(to: deepLinkUrl)
        }
        
        completionHandler()
    }
    
    /// Called when notification arrives while app is in foreground
    /// (This triggers the in-app banner via Capacitor plugin)
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Don't show system banner when app is in foreground
        // The Capacitor PushNotifications plugin handles this
        // and fires the "pushNotificationReceived" event which
        // triggers our in-app banner component
        completionHandler([])
    }
    
    // MARK: - Helper Functions
    
    /// Navigate to a route inside the Capacitor WebView
    private func navigateInApp(to path: String) {
        DispatchQueue.main.async {
            // Post to Capacitor's WebView via JavaScript
            NotificationCenter.default.post(
                name: NSNotification.Name("KaizenDeepLink"),
                object: nil,
                userInfo: ["path": path]
            )
            
            // Alternative: Direct WebView JS evaluation
            // If you have access to the bridge:
            // bridge?.webView?.evaluateJavaScript("window.location.href = '\(path)'")
        }
    }
    
    /// Send inline reply to backend
    private func sendNotificationReply(
        activityId: String?,
        recruitId: String?,
        replyText: String,
        notificationType: String
    ) {
        // Get the Supabase URL and auth token from your app config
        guard let supabaseUrl = Bundle.main.infoDictionary?["SUPABASE_URL"] as? String ?? 
              ProcessInfo.processInfo.environment["SUPABASE_URL"] else {
            print("[Kaizen] No Supabase URL configured")
            return
        }
        
        // You'll need to get the current auth token from Capacitor/WebView
        // For now, use the anon key and let the edge function handle auth
        let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqeGx6Y3VxcG9hbXJ3dW1zemF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDI0OTgsImV4cCI6MjA3OTY3ODQ5OH0.eBQbIe6CoALiFyiN6qlSq6MaR2NPE_OCBvhmGKqB8FI"
        
        let url = URL(string: "\(supabaseUrl)/functions/v1/handle-notification-reply")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        
        let body: [String: Any?] = [
            "activityId": activityId,
            "recruitId": recruitId,
            "replyText": replyText,
            "notificationType": notificationType
        ]
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: body.compactMapValues { $0 })
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                print("[Kaizen] Reply failed: \(error)")
                return
            }
            if let httpResponse = response as? HTTPURLResponse {
                print("[Kaizen] Reply sent, status: \(httpResponse.statusCode)")
            }
        }.resume()
    }
    
    /// Send a react-back (🔥) to an activity
    private func sendReactBack(activityId: String) {
        // Similar to sendNotificationReply but calls a different endpoint
        // For now, log and handle when user opens the app
        print("[Kaizen] React back to activity: \(activityId)")
        navigateInApp(to: "/recruits?reactTo=\(activityId)")
    }
    
    /// Reschedule a notification (for snooze)
    private func rescheduleNotification(
        from request: UNNotificationRequest,
        delayMinutes: Int
    ) {
        let content = request.content.mutableCopy() as! UNMutableNotificationContent
        content.title = "⏰ Reminder: \(request.content.title)"
        
        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: TimeInterval(delayMinutes * 60),
            repeats: false
        )
        
        let newRequest = UNNotificationRequest(
            identifier: "snoozed_\(request.identifier)",
            content: content,
            trigger: trigger
        )
        
        UNUserNotificationCenter.current().add(newRequest) { error in
            if let error = error {
                print("[Kaizen] Snooze failed: \(error)")
            } else {
                print("[Kaizen] Snoozed for \(delayMinutes) minutes")
            }
        }
    }
}
