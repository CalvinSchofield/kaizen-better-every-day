

# Fix Build Errors + Redesign Calendar Integration

## Part 1: Fix NodeJS.Timeout Build Errors

The `NodeJS` namespace isn't available because `@types/node` isn't in the TypeScript config. Simple fix: replace all `NodeJS.Timeout` with `ReturnType<typeof setTimeout>` across 9 files.

**Files:** `LogSaleSheet.tsx`, `PendingSalesAlert.tsx`, `SaleDetailSheet.tsx`, `TrackWithLayout.tsx`, `CalendarPlanningCard.tsx`, `TrainingTimer.tsx`, `usePendingSalesQueue.ts`, `LogSale.tsx`, `Track.tsx`

---

## Part 2: Native Calendar & Reminders Integration

### Problem
The current approach generates an `.ics` file or Google Calendar URL — neither works in a Capacitor WebView. The time picker falls back to an HTML `<input type="time">` which isn't native. The UX is a clunky separate panel inside the drawer.

### Solution: `@ebarooni/capacitor-calendar` Plugin

Install `@ebarooni/capacitor-calendar` which provides:
- **`createEventWithPrompt()`** — opens the native iOS event creation sheet (the exact UI in your screenshot) with pre-filled title, date, time, notes. The user confirms and picks their calendar. No separate permission flow needed.
- **`createReminderWithPrompt()`** — same but for Reminders app on iOS
- Native time picker comes free since the OS sheet handles it

This means we don't need our custom time picker, date picker, or any of the current calendar prompt UI for native. The OS handles everything beautifully.

### Smart Type Detection

Based on the action/notes text, auto-suggest the right type:

```text
"text", "message", "send"     → Reminder (quick task, no duration)
"call", "meet", "visit",      → Calendar Event (15 min default)
  "in person", "zoom"
Everything else                → Calendar Event (default)
```

### New UX Flow

Instead of the current clunky panel-within-drawer, after scheduling a follow-up:

1. A simple bottom prompt appears: **"Add to Calendar?"** with two chips: `📅 Calendar` and `⏰ Reminder` (smart default pre-selected based on notes)
2. Tapping either immediately opens the **native iOS sheet** (like your screenshot) pre-filled with title, date, time, recruit phone in notes
3. User confirms/adjusts in the native UI and it's done
4. On web (non-native), fall back to the current `.ics` download / Google Calendar approach but with the same simplified prompt UI

### Files to Change

**New/Updated utils:**
- `src/utils/nativeCalendar.ts` — rewrite to use `@ebarooni/capacitor-calendar` for native, keep web fallbacks
- Remove `src/utils/nativeTimePicker.ts` dependency from calendar flow (native sheet has its own picker)

**Redesigned component:**
- `src/components/mygroup/AddToCalendarPrompt.tsx` — simplified two-button prompt, no inline time picker, no event card preview. Just: "Add to Calendar?" → [Reminder] [Calendar Event] → native sheet opens

**Unchanged callers** (same interface):
- `PostContactDrawer.tsx`, `ScheduleFollowUpDrawer.tsx`, `RescheduleActivityDrawer.tsx` — still show `AddToCalendarPrompt` the same way, just looks/works better

**Build error fixes:**
- 9 files replacing `NodeJS.Timeout` → `ReturnType<typeof setTimeout>`

### New dependency
- `@ebarooni/capacitor-calendar` (supports Capacitor 6+, MIT license, 11K weekly downloads)

After implementation, you'll need to run `npx cap sync` on your local project to register the new native plugin.

