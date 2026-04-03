

## Redesign Rep Drill-Down Header

### What Changes

The current header has: avatar, name, year badge, team name, message button, and a calendar icon. The user finds the calendar icon unhelpful and wants the date context (period label like "Last Month") visible in the header so it persists while scrolling.

### Design — World-Class Mobile Pattern

A **sticky, compact header** that answers "who am I looking at and what timeframe" at a glance:

```text
┌──────────────────────────────────────┐
│ (avatar) Calvin Schofield  [Vet]  💬 │
│          Team Name · Last Month      │
└──────────────────────────────────────┘
```

Key decisions:
- **Remove** the Calendar icon button entirely (the `ActivityCalendarDrawer` can still be accessed via the `WeekActivityStrip` below)
- **Add period label** as a subtle badge/text next to team name so date context is always visible
- **Keep** ProfileAvatar (clickable to profile) and MessageSquare button
- **Keep** year badge (Vet/Rookie)
- Team name and period label sit on the subtitle line, separated by a dot

### Files to Modify

| File | Change |
|---|---|
| `src/components/reports/v2/RepDrillDownDrawer.tsx` | Remove Calendar import and button. Add `periodLabel` to the header subtitle line next to team name. Remove `showCalendar` state and `ActivityCalendarDrawer` rendering. |

### Technical Details
- Remove `Calendar` from lucide imports
- Remove `showCalendar` state (`useState(false)`)
- Remove the Calendar `<Button>` from header (lines 322-327)
- Remove `<ActivityCalendarDrawer>` block (lines 502-510)
- Remove `useRepActivityCalendar` import if no longer needed (still used by `WeekActivityStrip` via `calendarData` — keep it)
- Add period label to subtitle: `{rep.teamName && <span>{rep.teamName}</span>} · <span>{periodLabel}</span>`
- Style the period label with a subtle accent color so it stands out as temporal context

