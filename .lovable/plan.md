

## Plan: Stage-filter summer recommendations, "Needs Setup" chip, and summer-active card styling

### 1. Filter summer recommendations by stage

**File:** `src/pages/MyGroup.tsx` (lines 345-350)

Add a stage filter to the `summerReps` builder so only reps at Signed, Shadow ✅, Sold 💲, or Sold (5+) 💰 are included. The `allRecruits` array already has `recruit.stage` — add a check:

```typescript
.filter(rep => {
  const config = recruitsSummerConfigData.find(c => c.user_id === rep.user_id);
  const recruit = allRecruits.find(r => r.id === rep.id);
  const isActiveStage = recruit && ['Signed', 'Shadow ✅', 'Sold 💲', 'Sold (5+) 💰'].includes(recruit.stage);
  return isActiveStage && config?.personal_summer_start && config.personal_summer_start <= today;
})
```

Uses `SIGNED_PLUS_STAGES` from `stageConstants.ts` for consistency.

### 2. New "Needs Summer Setup" attention chip

**File:** `src/hooks/useNeedsAttention.ts`

Add a new category `summer-setup` that surfaces reps who are at Signed+ stages but are missing summer dates OR goals. Logic:

- Filter `recruits` where `stage ∈ SIGNED_PLUS_STAGES`
- Cross-reference with `recruitsSummerConfigData` and `recruitsGoalsData` (these will need to be passed in or fetched)
- Flag reps missing `personal_summer_start` OR missing all 3 goal tiers (must/will/could all = 0)
- Badge: `⚙️ Needs Setup` with count
- Urgency: `high` if summer has globally started (e.g., April 12+), `medium` otherwise

**File:** `src/components/mygroup/NeedsAttentionChips.tsx`

Add color entry for `summer-setup`:
```typescript
'summer-setup': 'bg-rose-500/10 text-rose-600 border-rose-500/30 hover:bg-rose-500/20',
```

This will require passing season config and goals data into `useNeedsAttention` — I'll add optional params to the hook.

### 3. Visually distinct summer-active cards on the Kanban board

**File:** `src/components/mygroup/RecruitKanbanBoard.tsx`

For reps whose summer has started (`personalSummerStart <= today` AND stage ∈ SIGNED_PLUS_STAGES), apply a distinct card treatment:

- **Subtle emerald left border** (4px) replacing the default card border — signals "summer active" at a glance
- **Micro summer badge**: A tiny `☀️ Active` pill in emerald tones next to the name, replacing the blocker icons (which become irrelevant post-summer)
- **FP+ progress snippet**: Show current FP+ below the name (e.g., "12.5 FP+") instead of the preseason contact/blitz badges — the data that matters shifts
- **Card background**: Very subtle `bg-emerald-500/[0.03]` tint in dark mode, `bg-emerald-50/50` in light mode — breathtaking but not loud

The card conditionally renders different Row 3 content:
- **Preseason cards**: Days since contact, blitz countdown, follow-up badges (current behavior)
- **Summer cards**: FP+ total, pace badge (on-track/behind), knocking days count

This requires passing `recruitsSummerConfigData` into the Kanban component.

### Technical details

- Stage filtering uses the existing `SIGNED_PLUS_STAGES` constant from `stageConstants.ts`
- Summer config data flows from the existing `useTeamSummerConfig` hook already called in `MyGroup.tsx`
- The Kanban card conditionally renders based on a simple `isSummerActive` boolean computed per-recruit
- No database changes needed — all data already exists

