

# Fix the Empty Blitzes Page + Add Blitz Recap with Stats

## Problems

1. **Redirect kills the page for leaders post-summer**: Line 189-193 redirects to `/leaderboard` when summer starts. Leaders can never see blitzes again.
2. **Empty state when no future blitzes**: Once all blitzes are past, the page shows a thin "Preseason Recap" with just a count ("3 blitzes attended") and a Vivint sync CTA. No blitz list, no stats. Feels abandoned.
3. **Leaders can't see current/past blitz list**: The `VetBlitzCard` only renders if `committedBlitzesArr.length > 0` AND only shows future blitzes from `allBlitzes` (which filters out past ones).
4. **No real blitz recap**: The "3/4 blitzes attended with stats" idea was never built beyond a simple count.

## The Fix

### 1. Remove the summer redirect for leaders
Leaders keep access to the Blitzes page year-round (it's already in their nav conditionally). Remove the redirect at lines 189-193 entirely — the nav logic in `Layout.tsx` already handles hiding/showing the Blitzes tab appropriately. Non-leaders who somehow land here post-summer can still be redirected.

### 2. Build a proper "Preseason Recap" section
When there are no future blitzes, replace the current thin recap with a richer section showing each attended blitz as a card with stats pulled from `daily_entries`:

For each past committed blitz, query the user's `daily_entries` where `entry_date` falls within the blitz's date range. Aggregate:
- **Days worked** (entries with work_start_time)
- **Doors knocked** (sum)
- **FP+** (sum)
- **PRMR** (sum)

Display as compact cards: blitz name, location, date range, and a stats row.

### 3. Show past blitzes for leaders
Leaders should see a collapsible "Past Blitzes" section below the recap, listing all blitzes (not just their committed ones) with attendance counts from `useBlitzAttendance`. This uses the existing `allBlitzesIncludingPast` from `useBlitzes`.

### Implementation

**New hook: `src/hooks/useBlitzRecapStats.ts`**
- Takes the user's committed blitzes (past only)
- For each, queries `daily_entries` for that user within the blitz date range
- Returns array of `{ blitz, daysWorked, doors, fpPlus, prmr }`

**File: `src/pages/Blitzes.tsx`**
- Remove summer redirect (or scope it to non-leaders only)
- In the "no upcoming blitz" hero state, replace the simple count with the recap component
- Add a "Past Blitzes" list below content for leaders showing all past blitzes from `allBlitzesIncludingPast`

**New component: `src/components/BlitzRecapCard.tsx`**
- Renders a single past blitz with stats in a compact card format
- Blitz name + location header, date range subtitle, stats row (days · doors · FP+ · PRMR)

### Files Changed
- `src/pages/Blitzes.tsx` — remove leader redirect, integrate recap + past blitz list
- `src/hooks/useBlitzRecapStats.ts` — new hook to fetch per-blitz stats from daily_entries
- `src/components/BlitzRecapCard.tsx` — new recap card component

