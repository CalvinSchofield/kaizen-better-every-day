

## Search Drawer UX Redesign

The issues from the screenshot are clear:

1. **Weird cutoff/dead space** at the bottom — the drawer's `max-h-[85svh]` conflicts with the base `DrawerContent` which already sets `maxHeight: min(90svh, 90vh)`. The inner container also has its own `calc(85svh - 80px)` max-height, creating a gap between the content and the drawer bottom edge.

2. **Height too small** — on mobile with keyboard open, the drawer doesn't use enough vertical space, leaving results barely visible (only ~2 items shown).

3. **Choppy feel** — the `CommandList` has `max-h-none` but the parent constraints fight each other, and the `CommandGroup` heading takes space unnecessarily.

### Plan

**Remove conflicting height constraints and let the drawer fill naturally:**

- Remove `max-h-[85svh]` from `DrawerContent` — the base drawer component already handles max height at 90svh
- Remove the inline `style={{ maxHeight: 'calc(85svh - 80px)' }}` from the inner div — replace with `flex-1 min-h-0 overflow-hidden`
- Set the drawer to use a taller snap point — change `DrawerContent` to `min-h-[85svh]` so it opens tall by default (nearly full-screen), giving maximum room for results especially when the keyboard is up

**Clean up the visual design for a polished native feel:**

- Remove the `DrawerHeader` and `DrawerTitle` ("Search Recruits") — the search input itself makes the purpose obvious; this saves ~50px of vertical space
- Remove the `CommandGroup` heading ("X results") — move the result count as a subtle inline label below the search input or remove entirely
- Tighten padding: reduce `px-5 pb-6` to `px-4 pb-4`
- Add a subtle top safe area and make the drag handle the only header element
- Ensure `CommandList` uses all remaining vertical space with proper flex layout

**Result rows polish:**

- Keep existing row design (it's good) but ensure consistent spacing with `gap-2` instead of `mb-1`

### Files to change

1. **`src/components/mygroup/RecruitSearchDrawer.tsx`** — Remove header, fix height constraints, streamline layout to be nearly full-screen with flex-based sizing so the list gets maximum space regardless of keyboard state.

