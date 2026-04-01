

# Page Tours Audit & Implementation Plan

## Current State

You have a **well-built tour system** (`PageTour` component + `usePageTour` hook) with spotlight overlays, swipe navigation, haptics, and persistent completion tracking. However, almost none of it is actually wired up:

### What exists but is NOT connected:

| Page | Tour steps defined in `pageTours.ts` | `data-tour` attributes on elements | Actually wired up? |
|------|------|------|------|
| **Home** | 3 steps | None | No |
| **Track** | 6 steps (incl. actions to open drawers) | Yes - time bar, counter grid, sale type toggle, PRMR help, upgrade calc | No |
| **Calendar** | 2 steps | Yes - grid, day tile | No |
| **Insights** | 3 steps | Yes - date range, tabs, metrics | No |
| **Leaderboard** | 4 steps | Yes - hero, filters, sales, grit | No |
| **My Group** | 5 steps (in pageTours.ts) | Partial (attention chips only) | Only `LeaderOnboardingTour` (separate, simpler tooltip system — not using the main `PageTour` component) |
| **Customers** | 3 steps | None | No |
| **Reports** | 3 steps | None | No |
| **Goals** | 7 steps | Partial (tier selector, date grid, blitz button) | No |

### Issues to fix:
1. **Zero pages use the main `PageTour` component** — the step configs in `pageTours.ts` are completely orphaned
2. **`LeaderOnboardingTour` is a duplicate system** — it reimplements positioning/overlay logic instead of using `PageTour`
3. **Missing `data-tour` attributes** on Home, Customers, and Reports pages
4. **Home tour references elements** (`home-journey-card`, `home-quick-actions`) that may not exist with those data attributes
5. **Goals tour is 7 steps** — may be too many; some reference elements that need attributes added

## Plan

### 1. Wire up `PageTour` on each page (the core work)
For each page (Home, Track, Calendar, Insights, Leaderboard, Goals), add:
- Import the tour steps from `pageTours.ts`
- Add `usePageTour` hook
- Render `<PageTour>` component with the steps
- For Track page: wire up `onStepAction` callbacks for opening the Log Sale sheet, switching to upgrade mode, etc.

### 2. Add missing `data-tour` attributes
- **Home**: Add attributes to journey card, quick actions section, bottom nav
- **Customers**: Add attributes to customer list, status tabs, map toggle
- **Reports**: Add attributes to date range picker, scope selector, export button
- **Goals**: Add missing attributes (hero ring, commitment chips, calendar planning card, settings button)

### 3. Consolidate `LeaderOnboardingTour`
Replace the separate tooltip-based `LeaderOnboardingTour` with the main `PageTour` component using the `myGroupTourSteps` from `pageTours.ts`. This gives leaders the same polished spotlight experience.

### 4. Review & polish tour step content
- Trim Goals tour from 7 to ~4 steps (combine related steps)
- Ensure descriptions are conversational and action-oriented
- Verify step ordering matches natural top-to-bottom page flow

### 5. Add tour replay from Settings
Add a "Replay Page Tours" option in settings that calls `resetAllTours()` so users can re-experience them.

### Priority order
Start with **Track** (most complex, most used page), then **Home**, **Goals**, **Calendar**, **Insights**, **Leaderboard**, **My Group** consolidation, then **Customers/Reports** last.

