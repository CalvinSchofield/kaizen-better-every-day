
### Objective
Fix false “not attended” states and deliver a world-class ESPN/Spotify-style Blitz archive where attended blitzes feel like trophies and open into a rich post-blitz breakdown.

### What’s still broken
- Attended highlighting is currently tied to `recapStats.find(r => r.id === blitz.id)` while rendering only `allPastBlitzes` from the active blitz catalog.
- If a user has committed/attended blitzes not present in `allPastBlitzes` (legacy or mismatched source), those appear as unattended.
- The past section is hidden when `nextBlitz` exists (`!nextBlitz` gate), so an active/upcoming blitz suppresses trophy history.
- No tap-through “game detail” experience yet.

### Product direction (world-class coach + mobile app)
1. **One “Season Scoreboard” feed**
   - Show all past blitzes.
   - Attended blitzes are premium trophy cards with accent + stats.
   - Unattended blitzes stay lightweight context rows.

2. **Tap to open “Blitz Gamecast”**
   - ESPN-inspired structure: sticky header + tabbed detail.
   - Spotify Wrapped vibe: highlights, wins, records, comparisons.

3. **Leader functionality never disappears pre-summer**
   - Keep `VetBlitzCard` visible for leaders whenever active/future blitzes exist (preserve current fix).

### Implementation plan
1. **Normalize attendance source-of-truth**
   - Build a merged past dataset from:
     - `allPastBlitzes` (schedule)
     - past items from `repData.committed_blitzes` (legacy-safe)
   - Mark `attended` by committed blitz IDs, not by recap existence.

2. **Fix visibility + ordering**
   - Move “Preseason Blitzes” section outside `!nextBlitz` condition.
   - Sort attended first (newest first), then unattended (newest first).

3. **Upgrade card behavior**
   - Extend `BlitzRecapCard` with `attended` and `onOpenDetails`.
   - Attended: stronger accent + stat pills + “View Recap”.
   - Unattended: muted compact layout.

4. **Add blitz detail drawer (phase 1)**
   - New `BlitzDetailDrawer` opened from attended cards.
   - Tabs:
     - **Overview** (totals: days, doors, FP+, PRMR, closes, hours)
     - **Inputs** (funnel + pace)
     - **Customers** (sales log/deal events in blitz window)
     - **Wins** (records + challenges/incentives earned in window)
     - **Watchlist** (you vs watched reps during same blitz)

5. **Add focused hooks**
   - `useBlitzDetailStats(blitz)`
   - `useBlitzWatchlistComparison(blitz)`
   - `useBlitzAchievements(blitz)`
   - Centralized date-window helper for consistent filtering across tabs.

6. **Countdown polish when no future blitzes**
   - Keep big summer countdown.
   - Add richer preseason summary strip (blitzes, doors, FP+, PRMR, best blitz).
   - Keep sync CTA but reduce prominence below countdown/trophies.

### Files to update
- `src/pages/Blitzes.tsx`
- `src/components/BlitzRecapCard.tsx`
- `src/hooks/useBlitzRecapStats.ts`
- `src/components/blitz/BlitzDetailDrawer.tsx` (new)
- `src/hooks/useBlitzDetailStats.ts` (new)
- `src/hooks/useBlitzWatchlistComparison.ts` (new)
- `src/hooks/useBlitzAchievements.ts` (new)

### Technical details
- No required DB migration for phase 1 (reuse existing backend data).
- Add robust blitz ID normalization (`supabaseId || id`) and legacy-safe matching.
- Keep date filtering inclusive and local-date safe using existing blitz date utilities.
- Query keys scoped by user + blitz range for performant drawer caching.
- Mobile-first UX: sticky header + sticky tabs + scrollable body in ~90vh drawer.
- Empty-data handling: attended blitz still shows trophy state even if tracked metrics are zero.

### Acceptance criteria
- Users who attended blitzes are always shown as attended (including legacy cases).
- Past blitz trophy history remains visible even when a current/upcoming blitz exists.
- Leaders always retain blitz management card pre-summer when applicable.
- Tapping an attended blitz opens a detailed, tabbed recap experience.
- End-to-end mobile verification covers:
  - attendance detection
  - ordering/highlighting
  - drawer content accuracy
  - leader visibility behavior
