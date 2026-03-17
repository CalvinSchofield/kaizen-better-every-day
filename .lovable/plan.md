# What Happens to `/blitzes` Once Summer Starts?

## The Problem

Once summer begins, the Blitzes page has zero value. Blitzes are a preseason concept. The page is already removed from the bottom nav in knocking mode (summer), so it becomes an orphaned route that users can only reach by accident.

## Recommendation: Retire the Route, Don't Repurpose It

Rather than trying to shoehorn summer content into a "Blitzes" URL, the cleaner approach is:

1. **Redirect `/blitzes` to the appropriate summer home** once the user's `personal_summer_start` has passed. If knocking mode is active, redirect to `/leaderboard` (the first summer nav tab). This way any stale bookmarks or deep links gracefully land somewhere useful.
2. **No new page needed** — the summer nav already covers every surface area:
  - **Leaderboard** — competition and rankings
  - **Tools** — door-to-door resources
  - **Reports / Compete** — performance and challenges
  - **Track** — daily activity (action button)
  - **Goals** — targets and pacing
3. **Move the "Summer Countdown" hero** that currently lives on the Blitzes page into the **Goals page** or **Home page** during the transition period (the days between last blitz ending and summer actually starting). That way the countdown and "edit summer dates" feature remain accessible from a page users actually visit.

