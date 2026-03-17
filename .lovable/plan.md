## Push Notification Fix – Complete

### What was changed (code side)

1. **`src/hooks/useNativePushNotifications.ts`** – Rewritten as single source of truth:
   - Listeners set up once (ref guard)
   - Token stored with retry: if no session at callback time, token is parked and retried on auth state change or app resume
   - Per-user token queries (no global counts)
   - Debug state includes explicit phases: `init → permission_checked → register_called → token_received → token_saved`
   - App resume listener re-registers with APNs

2. **`src/components/PushNotificationInitializer.tsx`** – Stripped to thin bootstrapper:
   - Only calls `PushNotifications.register()` if permission already granted
   - No duplicate listeners (all handled by the hook)

3. **`src/hooks/useUnifiedPushNotifications.ts`** – Exposes `refreshStoredTokenFlag`

4. **`src/pages/Settings.tsx`** – All APNs token queries now filter by current user. Debug panel shows phase + Xcode capability warning.

5. **`supabase/functions/test-push-notification/index.ts`** – Returns `success: false` + 502 when 0 notifications sent.

---

### What YOU need to do (step by step)

#### Step 1: Open Terminal
Open the Terminal app on your Mac. Navigate to your project folder:
```bash
cd ~/path-to-your-project
```
(Replace with your actual folder path. If you're not sure, right-click the folder in Finder → "Copy as Pathname", then type `cd ` and paste.)

#### Step 2: Pull & build
```bash
git pull
npm install
npm run build
npx cap sync ios
```

#### Step 3: Open in Xcode
```bash
npx cap open ios
```

#### Step 4: Xcode — Add Push Capability (CRITICAL)
1. In the left sidebar, click the blue **App** project icon (top of the file tree)
2. Select the **App** target (under TARGETS)
3. Click **Signing & Capabilities** tab
4. Click **+ Capability** (top left)
5. Search for **Push Notifications** → double-click to add it
6. Click **+ Capability** again → search **Background Modes** → add it
7. Check ✅ **Remote notifications**

#### Step 5: Verify AppDelegate
Open `ios/App/App/AppDelegate.swift`. You need these methods. If they're missing, add them inside the `AppDelegate` class:

```swift
func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
}

func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
}
```

#### Step 6: Build & deploy
1. In Xcode: **Product → Clean Build Folder** (Shift+Cmd+K)
2. Select your physical iPhone as the run target (top bar)
3. **Product → Build** (Cmd+B)
4. To push to TestFlight: **Product → Archive**, then **Distribute App → App Store Connect**

#### Step 7: Test on device
1. Install the new TestFlight build
2. Open the app, log in
3. Go to **Settings → Developer Tools**
4. Tap **Re-register & Self-Test Push**
5. You should see:
   - Phase: `token_saved`
   - APNs token in DB: Yes
   - Test notification arrives on your phone

If Phase stays at `register_called` and no token appears → the Xcode capability (Step 4) is likely missing.

---

### PWA Push (after TestFlight works)
1. On your iPhone, open Safari → go to `https://kaizen-better-every-day.lovable.app`
2. Tap Share → **Add to Home Screen**
3. Open the app from your Home Screen (must be the Home Screen version, not Safari)
4. Go to Settings → enable notifications
5. Test with the notification button
