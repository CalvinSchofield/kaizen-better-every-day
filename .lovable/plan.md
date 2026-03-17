

# Redesign Blitzes Page: Complete, Beautiful, Functional

## Problems Identified

1. **VetBlitzCard (Blitz Management) hidden when leader has no committed blitzes** — Line 640 guards on `committedBlitzesArr.length > 0`. A leader who didn't personally attend blitzes loses access to team management tools (attendance tracking, inviting, commitments). Leaders need this card visible whenever there are active/future blitzes, regardless of personal commitment.

2. **Recap cards only show for user's committed blitzes, not all past blitzes** — The recap section (line 665) only renders `recapStats` from the user's `committed_blitzes`. The "Past Blitzes" collapsible (line 677) shows all blitzes but with zero stats — just name/date. No visual distinction between attended vs not-attended.

3. **Summer countdown is buried in a small pill** — When there are no more blitzes, the hero just says "Summer Starts Soon" with a tiny pill. It should feel like the main event.

4. **Page feels abandoned** — No visual richness, no sense of accomplishment for the preseason work done.

## Design Philosophy

A world-class mobile app would treat this like **Strava's season recap** or **Spotify Wrapped** — the end of preseason is a moment of pride, not an empty page. The past blitzes you attended are trophies. The ones you didn't are context.

## Implementation

### 1. VetBlitzCard visibility for leaders (`src/pages/Blitzes.tsx` ~line 639-662)

Change the guard from `committedBlitzesArr.length > 0` to show for leaders whenever there are any active/future blitzes (`allBlitzes.length > 0`):

```
{(committedBlitzesArr.length > 0 || (isLeader && allBlitzes.length > 0)) && (
```

This ensures leaders always see the management card for in-progress or upcoming blitzes even if they personally aren't committed.

### 2. Merge "Past Blitzes" and "Recap" into one unified section (`src/pages/Blitzes.tsx` ~line 664-701)

Replace the separate recap cards + plain past blitzes collapsible with a single "Preseason Blitzes" section that shows ALL past blitzes, but visually distinguishes attended ones:

- **Attended blitzes** get the full `BlitzRecapCard` with stats (days, doors, FP+, PRMR) and a warm accent left-border (primary color) — these are trophies.
- **Not attended blitzes** render as simple muted rows (name, location, date) — context only.
- For leaders, show all past blitzes. For reps, show all past blitzes too (attended ones highlighted, others dimmed).

This requires:
- Passing `allPastBlitzes` alongside `recapStats` to create a merged list
- Cross-referencing which blitzes the user committed to (by ID match)

### 3. Elevate the Summer Countdown hero (`src/pages/Blitzes.tsx` ~line 519-585)

When there are no more blitzes and summer hasn't started:
- Make the countdown number **massive** (text-6xl) like a real countdown clock
- Add a summary line: "X blitzes · Y doors · Z FP+" aggregating ALL attended blitz stats
- Keep the Vivint sync CTA but move it below the recap section, not in the hero

### 4. Enhance BlitzRecapCard with accent styling (`src/components/BlitzRecapCard.tsx`)

- Add a left accent border (`border-l-4 border-primary`) to attended blitz cards
- Warm stat pill backgrounds (`bg-primary/10` instead of `bg-muted/50`)
- This makes attended blitzes visually pop as accomplishments

### Files Changed

- `src/pages/Blitzes.tsx` — Leader VetBlitzCard guard fix, unified past blitzes section, elevated summer countdown hero with aggregate stats
- `src/components/BlitzRecapCard.tsx` — Accent border + warmer stat pill styling

