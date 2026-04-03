

# Summer Availability Tab Overhaul

## What we're building

A complete redesign of the Summer Availability tab inside the QuickView drawer on the My Group page. The new view is a calendar-centric availability dashboard that lets leaders of 50+ reps quickly see who's off, when, and nudge those who haven't set up their goals/dates.

## Design

```text
┌─────────────────────────────────────┐
│  Summer Availability    [Filter ▼]  │  <- UnifiedFilterDrawer trigger
│  ─────────────────────────────────  │
│  Apr 12 - Sep 27, 2026 • 38 reps   │
│                                     │
│  [⚠ 5 Need Setup] [🏖 3 Off Today] │  <- Tappable stat chips
│                                     │
│  ◄  Apr 14 - Apr 18  (This Week) ► │  <- Week navigator
│  ┌──┬──┬──┬──┬──┬──┐               │
│  │Mo│Tu│We│Th│Fr│Sa│               │
│  ├──┼──┼──┼──┼──┼──┤               │
│  │  │  │🔴│  │  │  │ Jake          │  <- Red dot = off day
│  │  │  │  │  │🔴│🔴│ Sarah         │
│  │  │  │  │  │  │  │ Tyler ✅      │  <- All working
│  └──┴──┴──┴──┴──┴──┘               │
│                                     │
│  ── Needs Setup (5) ──────────────  │
│  [Avatar] Emma - No goals set       │
│                        [Nudge 🔔]   │  <- Sends push notification
│  [Avatar] Marcus - No dates set     │
│                        [Nudge 🔔]   │
└─────────────────────────────────────┘
```

## Key features

1. **Unified Filter integration** -- Replace the basic team/group dropdown with `UnifiedFilterDrawer` (same as Reports page), supporting hierarchy, year filters, and watchlist.

2. **Week-based calendar grid** -- Horizontal week view (Mon-Sat, no Sunday) showing each rep as a row. Off days marked with colored dots. Swipeable left/right to navigate weeks. Much more scannable than the current timeline bars for 50+ reps.

3. **Tap rep name to expand** -- Tapping a rep's name opens an inline expandable card showing all their off days listed out, their summer date range, and total off days. For mgmt_group_lead+, an "Edit Dates" button appears to open the existing `EditSummerDatesDrawer`.

4. **Needs Setup section** -- Reps without goals OR without summer start/end dates grouped at the bottom with a prominent "Nudge" button that sends an APNS push notification saying "Your leader wants you to set up your summer goals and dates in the app."

5. **Nudge via push notification** -- New edge function `send-setup-nudge` that sends an APNS push to the rep prompting them to complete goal setup. Uses the existing `send-apns-notification` pattern.

6. **Edit access for mgmt_group_lead+** -- The existing `EditSummerDatesDrawer` is already wired up. We just need to gate the edit button to `hasMinAccess(accessLevel, 'mgmt_group_lead')` instead of the current generic `isLeader` check.

## Files to create/modify

| File | Change |
|---|---|
| `src/components/mygroup/SummerAvailabilityView.tsx` | Full rewrite: calendar grid, unified filter, expand-on-tap, nudge buttons, week navigation |
| `src/components/mygroup/QuickViewDrawer.tsx` | Pass filter state down to SummerAvailabilityView if needed |
| `supabase/functions/send-setup-nudge/index.ts` | New edge function: validates leader access, sends APNS push to target rep |

## Technical details

- **Week grid rendering**: Generate Mon-Sat columns for the selected week. Each rep row checks `excludedSummerDays` for matches. Reps not yet started or already ended get a muted row with a "Not here yet" / "Summer ended" label.
- **Filter integration**: Import `UnifiedFilterState`, `UnifiedFilterDrawer`, and filter reps by selected nodes + year filters, matching the same pattern used in `MyGroup.tsx`.
- **Nudge edge function**: Accepts `{ targetUserId, nudgeType: 'goals' | 'dates' }`. Looks up APNS tokens, calls `send-apns-notification` internally. Logs to `notification_logs` to prevent spam (max 1 nudge per rep per 24h).
- **Edit gating**: `hasMinAccess(accessLevel, 'mgmt_group_lead')` controls visibility of the edit pencil icon on each rep's expanded view.
- **Performance**: For 50+ reps, the calendar grid uses virtualized rendering only if needed. The week view naturally limits to 6 columns so it stays lightweight.

