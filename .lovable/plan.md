

# Goals Page Redesign: Move Countdown + Unified Visual Language

## What's Wrong Today
1. **SummerCountdownHero sits above the hero ring**, pushing progress down — the most important thing is buried
2. **Cards are visually inconsistent**: amber tint (CanceledStats), blue tint (PendingInstalls), orange gradient (SummerCountdown), neutral (CalendarPlanning, Earnings) — feels patchwork, not designed
3. The page reads like a stack of unrelated cards rather than one cohesive dashboard

## The Plan

### 1. Move Summer Countdown below CalendarPlanningPreview
Relocate `<SummerCountdownHero>` from its current position (line 845, above the hero ring) to **after** the `CalendarPlanningPreview` card (line 933). This makes the hero ring + tier chips + progress the first thing you see. The countdown becomes a subtle contextual card in the planning section where it belongs.

### 2. Unified card design system — neutral palette with accent dots
Strip the colored backgrounds (`bg-amber-500/5`, `bg-blue-500/5`, `bg-gradient-to-br from-amber-500/10 to-orange-500/10`) from all cards. Replace with a consistent system:

- **All cards**: `bg-card border border-border/50 rounded-2xl` — clean, same surface
- **Status indicator**: A small colored dot or icon badge (amber dot for canceled, blue dot for pending, orange dot for countdown) instead of painting the entire card
- **Consistent padding**: `p-4` across all cards
- **Consistent header pattern**: icon-in-circle + title + optional badge, right-aligned chevron or action

This immediately removes the "different colors" feeling while keeping semantic meaning via small accent touches.

### 3. Refine the SummerCountdownHero `goals-card` variant
Redesign it to match the new neutral card system — remove the gradient background, use a clean card with a subtle sunrise emoji and date text. Make it feel like a natural part of the planning section, not a promotional banner.

### 4. Subtle section grouping
Add lightweight visual separation between card groups:
- **Primary**: Hero ring (full width, no card wrapper — it's the star)
- **Planning**: CalendarPlanningPreview + SummerCountdown (grouped visually)
- **Financial**: EarningsBreakdownCard + CanceledStatsCard + PendingInstallsCard

Use a tiny `text-[10px] uppercase tracking-wider text-muted-foreground` section label before each group (e.g., "Planning", "Financials") — optional, can skip if it feels heavy.

### 5. Spacing rhythm
Standardize vertical gaps: `space-y-3` between cards within a group, `mt-6` between groups. Currently everything is `pb-4` which creates uniform but dull spacing.

## Files Changed
- `src/pages/Goals.tsx` — reorder cards, add section structure
- `src/components/SummerCountdownHero.tsx` — restyle `goals-card` variant to neutral
- `src/components/goals/CanceledStatsCard.tsx` — remove amber tinted background
- `src/components/goals/PendingInstallsCard.tsx` — remove blue tinted background

