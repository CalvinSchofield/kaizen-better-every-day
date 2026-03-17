
Goal: make iOS native (TestFlight) push registration reliable first, then ensure PWA push works on iPhone.

What I found from the current code/backend
- Native token table is empty (`apns_device_tokens` has 0 rows), so no iOS device has successfully stored a token yet.
- Web subscriptions exist (`push_subscriptions` has rows), so web push pipeline is at least partially working.
- Native registration logic is duplicated in two places:
  - `src/components/PushNotificationInitializer.tsx`
  - `src/hooks/useNativePushNotifications.ts`
  This can cause drift/race and makes debugging harder.
- Current debug checks in `Settings.tsx` count all APNs tokens globally (not per current user), which can mislead status.
- Biggest likely blocker for “permission granted but no token”: iOS native project wiring/capabilities (AppDelegate forwarding + Push capability/provisioning), not just JS code.

Implementation plan (code changes)
1) Consolidate native push registration into one source of truth
- Keep one canonical native registration flow in `useNativePushNotifications`.
- Refactor `PushNotificationInitializer.tsx` to call that shared flow (or remove duplicate listener/registration logic and only trigger a bootstrap call).
- Ensure registration runs:
  - after authenticated session is available
  - when app returns to foreground (resume) to recover from missed callbacks.

2) Make token storage resilient and user-specific
- In `useNativePushNotifications.ts`:
  - store token with robust upsert behavior (handle unique `device_token` collisions cleanly).
  - if session missing at callback time, retry once shortly after instead of dropping token forever.
  - improve debug state with explicit phases: permission_checked, register_called, token_received, token_saved.
- In `Settings.tsx` and hook refresh checks:
  - query `apns_device_tokens` filtered by current user only.

3) Improve diagnostics so failure reason is obvious
- In `Settings.tsx` developer section:
  - add a single “Native Push Health Check” action that reports:
    - authenticated user present?
    - permission state
    - registration callback received?
    - registration error message (if any)
    - token saved for this user?
  - show “Likely iOS capability/provisioning issue” when register callback never arrives within timeout.
- Update `test-push-notification` edge function to return failure if 0 notifications were actually sent (avoid false green checks).

4) Keep PWA flow explicit and separate
- In `Settings.tsx`, when platform is web:
  - show clear requirements for iPhone web push:
    - must use published URL (not preview/test shell)
    - must open as Home Screen app on iOS
    - must grant notifications via user action (toggle button).
- Keep web push subscribe/unsubscribe as-is, but improve status messaging when service worker/permission prerequisites aren’t met.

Technical details (files)
- `src/hooks/useNativePushNotifications.ts`
- `src/components/PushNotificationInitializer.tsx`
- `src/pages/Settings.tsx`
- `src/hooks/useUnifiedPushNotifications.ts` (if needed for status normalization)
- `supabase/functions/test-push-notification/index.ts`

No database schema changes required.

Noob-friendly runbook (TestFlight first)
1) Pull latest code locally
- Open Terminal in your project folder:
```bash
git pull
npm install
npm run build
npx cap sync ios
npx cap open ios
```

2) In Xcode (must-do checks)
- Select your app target → Signing & Capabilities:
  - Team selected
  - Bundle Identifier matches your Apple app identifier
  - Add capability: Push Notifications
  - Add capability: Background Modes → check “Remote notifications”
- Open `ios/App/App/AppDelegate.swift` and verify push forwarding methods exist (Capacitor push requirement):
  - `didRegisterForRemoteNotificationsWithDeviceToken`
  - `didFailToRegisterForRemoteNotificationsWithError`
  - both should post to Capacitor notification center names.
- Product → Clean Build Folder, then build and archive.
- Upload to TestFlight and install the new build on physical iPhone.

3) Device checks
- iPhone Settings → Notifications → your app → Allow Notifications ON.
- Open app, log in, go to Settings → Notifications/Developer Tools.
- Run “Re-register & Self-Test Push” and confirm:
  - Push Registered = Yes
  - APNs token in DB = Yes
  - test notification arrives.

4) Then validate PWA push
- On iPhone Safari, open published URL (`kaizen-better-every-day.lovable.app`).
- Share → Add to Home Screen.
- Open installed web app from Home Screen.
- Enable notifications from in-app Settings toggle.
- Send test web push and confirm delivery.

Acceptance criteria
- Native/TestFlight: token row exists for current user in `apns_device_tokens`, self-test APNs succeeds, notification received.
- PWA: subscription row exists for current user in `push_subscriptions`, test web push succeeds and displays.
- Status UI shows per-user truth (no global false positives).
