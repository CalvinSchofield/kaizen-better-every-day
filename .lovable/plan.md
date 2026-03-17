

## Fix In-App Notifications and Unify All Toasts to Top (iOS-Native Style)

### Problem Summary

Three issues:

1. **In-app notification banner never fires** because `useNativePushNotifications()` hook is never called by any mounted component. The `PushNotificationInitializer` component only calls `PushNotifications.register()` directly -- it never invokes the hook that sets up the `pushNotificationReceived` foreground listener.

2. **Sonner toasts appear at bottom-center**, covering the calendar/reminder additions on My Group and other pages.

3. **No toast respects the Dynamic Island safe area**, so anything at the top gets clipped under it.

### Plan

#### 1. Mount `useNativePushNotifications` in `PushNotificationInitializer`

The fix is simple: call `useNativePushNotifications()` inside `PushNotificationInitializer.tsx` so the foreground `pushNotificationReceived` listener is set up app-wide. This is the only missing piece -- the `emitInAppNotification` call and the `InAppNotificationBanner` component are already wired correctly.

#### 2. Move all Sonner toasts to top with safe-area spacing

In `src/components/ui/sonner.tsx`:
- Change `position` from `"bottom-center"` to `"top-center"`
- Add `offset` style to push toasts below the Dynamic Island: `calc(var(--effective-safe-area-top, 0px) + 0.5rem)`
- Style toasts to look more like native iOS notifications: rounded-2xl, backdrop blur, swipe-to-dismiss (Sonner supports swipe natively)
- Set a higher z-index so they layer correctly with other UI

#### 3. Move Radix toast viewport to top with safe-area spacing

In `src/components/ui/toast.tsx`:
- Update `ToastViewport` className from `top-0` to use safe-area offset
- Add `style={{ top: 'calc(var(--effective-safe-area-top, 0px) + 0.5rem)' }}`
- Ensure slide animations are `slide-in-from-top` on all breakpoints (currently bottom on sm+)

#### 4. Ensure no z-index conflicts

- In-app notification banner: z-[200] (keep)
- Sonner/Radix toasts: z-[190] (bump up from z-[100])
- This ensures push notification banners stack above regular toasts

### Files to Edit

- `src/components/PushNotificationInitializer.tsx` -- call `useNativePushNotifications()`
- `src/components/ui/sonner.tsx` -- position top-center, safe-area offset
- `src/components/ui/toast.tsx` -- viewport top with safe-area offset

### Technical Details

- Sonner's `position="top-center"` + `offset` prop handles the Dynamic Island gap
- `useNativePushNotifications()` sets up all four Capacitor push listeners including the critical `pushNotificationReceived` that emits to the in-app banner
- No database changes needed
- The existing swipe-to-dismiss on `InAppNotificationBanner` (swipe up) is preserved
- Sonner already has built-in swipe-to-dismiss support

