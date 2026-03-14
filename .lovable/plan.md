

## Plan: Hide Goals from drawer for leaders when knocking mode is off

**Why:** When knocking mode is off (preseason), leaders see Goals in the bottom nav bar. Showing it in the drawer too is redundant.

**File:** `src/components/AppDrawer.tsx` (line 312)

Wrap the Goals drawer item with a condition to hide it when the user is a leader and knocking mode is off:

```typescript
{/* ── GROWTH ── */}
<DrawerSection label="Growth">
  <DrawerItem to="/training" icon={BookOpen} label="Training" onClick={() => setOpen(false)} />
  {!(isLeader && !isKnockingMode) && (
    <DrawerItem to="/goals" icon={Target} label="Goals" onClick={() => setOpen(false)} />
  )}
</DrawerSection>
```

This uses the existing `isLeader` and `isKnockingMode` variables already in scope. One line change, no new dependencies.

