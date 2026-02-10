

# Reimagine the Calendar Day-Tap Drawer

## The Problem
Tapping any day on the calendar opens a full manual entry form (activity counters, time tracking, sales) that encourages reps to retroactively log entire days -- the opposite of how the app should work. The Track page is the intended real-time tracking tool.

## The Solution
Replace the current `SaveEntrySheet` usage in CalendarView with a new, lighter-weight `CalendarDayDrawer` that has two distinct states based on whether the day has data or not.

---

## State 1: Day WITH Data (read-only summary + Add Sale)

When tapping a past or current day that has finalized data:

- **Read-only activity summary** -- a compact card showing doors, pitches, closes, time worked (no editable inputs)
- **Sales list** -- existing sales shown as tappable chips (same style as current), opening the existing SaleDetailSheet
- **"+ Add Sale" button** -- for logging referrals or late-arriving sales (opens the existing LogSaleSheet flow)
- **No activity editing, no time editing** -- those fields are gone

```text
+-------------------------------+
|  Feb 8 - Saturday             |
+-------------------------------+
|  Activity          Time       |
|  42 doors          9:15 AM -  |
|  6 pitches         4:30 PM    |
|  2 closes          (7h 15m)   |
+-------------------------------+
|  Sales           [+ Add Sale] |
|  [FP $85] [FP $102]          |
|  FP+: 2.00  |  PRMR: $187    |
+-------------------------------+
```

## State 2: Day WITHOUT Data (nudge + Add Sale)

When tapping a past day with no data:

- **Friendly nudge message** -- "Track your day in real-time using the Track tab! It's the best way to capture your work accurately."
- **"Go to Track" button** -- navigates to /track (only shown if tapping today)
- **"+ Add Sale" button** -- for logging a referral or sale that happened on this day
- **No activity counters, no time inputs**

```text
+-------------------------------+
|  Feb 6 - Thursday             |
+-------------------------------+
|                               |
|  Track your day in real-time  |
|  using the Track tab!         |
|                               |
|  [+ Add a Sale or Referral]   |
|                               |
+-------------------------------+
```

## Today Behavior
Tapping today shows the same drawer logic as past days:
- If today has data: read-only summary + Add Sale
- If today has no data: nudge + Add Sale (with a "Go to Track" button since it's today)

---

## Technical Plan

### New file: `src/components/CalendarDayDrawer.tsx`
A clean, focused drawer component that replaces SaveEntrySheet usage in CalendarView:
- Props: `open`, `onOpenChange`, `entry`, `date`, `salesLog`, `onSaleAdded` (callback after adding a sale)
- **Has data path**: Renders a read-only activity/time card + sales list + Add Sale button
- **No data path**: Renders nudge text + Add Sale button + optional "Go to Track" (if today)
- Uses `LogSaleSheet` for adding sales (same component the Track page uses)
- Uses `SaleDetailSheet` for viewing existing sales
- When a sale is added, it calls the existing `finalizeEntry` mutation to upsert the entry with the new sale in `sales_log`
- Drawer component (mobile-native pattern), lightweight and snappy

### Edit: `src/components/CalendarView.tsx`
- Replace `SaveEntrySheet` import with `CalendarDayDrawer`
- Remove `handleSaveEntry` (the full manual save handler) -- no longer needed from calendar context
- Keep `handleDeleteEntry` for the delete option on finalized entries
- Wire up the new drawer with the selected date/entry data
- The `handleDayClick` logic stays the same (planning mode toggle, Sunday checks, etc.)

### NOT changing:
- `SaveEntrySheet.tsx` itself stays untouched -- it's still used by `TrackWithLayout.tsx` for the Track page save flow
- `LogSaleSheet` and `SaleDetailSheet` are reused as-is
- No database changes needed

