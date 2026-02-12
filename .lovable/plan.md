# Surface "Their Why" Throughout the Leader Experience

## Current State

The purpose statement is currently visible in only **2 places**:

- Reports V2 Rep Drill-Down Drawer
- Organization tab's Edit Rep Drawer

It's **missing** from the most-used leader view: the **Recruit Detail Drawer** in My Group.

## Where to Add It

### 1. Recruit Detail Drawer -- FocusCard (high impact)

The FocusCard is the hero section leaders see first when opening a rep's detail. Add the purpose statement as a subtle but visible element right below the pace/status info. This puts "Their Why" front and center during coaching moments.

- The data is already fetched (`rep_goals.*` query exists) but the `RecruitGoals` type in `types.ts` doesn't include `purpose_statement` or `purpose_updated_at`
- Add those fields to `RecruitGoals`
- Pass the purpose statement down to `FocusCard` and render a compact `PurposeDisplayCard` at the bottom of the card

### 2. Recruit Detail Drawer -- DetailsTab (secondary)

Also show it in the Details tab alongside other rep info (significant other, watch-out notes, etc.) for a more permanent reference point.

## Technical Steps

1. **Update `RecruitGoals` type** in `src/components/mygroup/recruit-detail/types.ts`
  - Add `purpose_statement?: string | null`
  - Add `purpose_updated_at?: string | null`
2. **Update `FocusCard` component** in `src/components/mygroup/recruit-detail/FocusCard.tsx`
  - Accept `purposeStatement` and `purposeUpdatedAt` props (or read from `recruitGoals`)
  - Render `PurposeDisplayCard` at the bottom of the focus card when a statement exists
3. **Update `RecruitDetailDrawer**` to pass the purpose data through to FocusCard
4. **Update `DetailsTab**` to show the purpose statement in the details section (fetch is already available via parent)

## Recommendation

Start with items 1-4 (Recruit Detail Drawer) since that's where leaders spend the most time and the data is already being fetched. 