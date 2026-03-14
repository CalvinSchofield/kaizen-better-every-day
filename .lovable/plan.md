

## Plan: Streamlined Stat Line for Post-Save Track Page

### Problem
The current collapsible stats area (Doors 29 · Pitches 10 · Trans 2 with a ▾ chevron expanding into a chunky 7-box grid) feels cluttered and redundant. Sales data is already accessible via the sale chips above. The user wants something clean, factual, and progressively disclosable.

### Approach: Apple Health-Style Inline Stat Line

World-class mobile apps (Apple Health, Strava, Oura) use a single **horizontal stat ribbon** — a compact, scannable row of key numbers that feels like metadata, not a dashboard. Deeper stats are accessed via a subtle "Details" tap, not an accordion full of boxes.

**Collapsed state** — a single clean line showing the full funnel in one glance:

```text
29 doors · 10 pitches · 2 trans · 5 pres · 3 closes
```

Just numbers and labels, no boxes, no borders, no grid. Monospaced numbers, muted labels, all inline. This replaces the current 3-stat summary + chevron.

**Expanded state** — instead of the heavy `FinalizedStatsGrid` with its 7 bordered boxes, show a clean **two-column list** with conversion rates:

```text
Doors          29
 └ DM Rate     34%  (10/29)
Pitches        10
 └ Trans Rate  20%  (2/10)
Presentations   5
 └ Close Rate  60%  (3/5)
FP+           2.34
PRMR         $199
```

This gives the "dig deeper" feel without overwhelming. The conversion percentages are coaching gold — they tell a story the raw numbers alone don't.

### Implementation

**File: `src/pages/Track.tsx`** (lines 302-371)
- Replace the current `motion.button` + `FinalizedStatsGrid` expand block
- New collapsed: single `<div>` with inline stats: `{doors} doors · {pitches} pitches · {trans} trans · {pres} pres · {closes} closes`
- Tap chevron → expand to the detailed stat list with conversion rates
- Remove the `FinalizedStatsGrid` import/usage from the finalized view (keep the component file for potential use elsewhere)

**File: `src/components/activity-ring/FinalizedStatsGrid.tsx`**
- No changes needed — we just stop using it here. It can remain for other contexts.

**Changes are scoped to ~70 lines in Track.tsx** — replacing the stats section with a cleaner inline ribbon + expandable detail list.

