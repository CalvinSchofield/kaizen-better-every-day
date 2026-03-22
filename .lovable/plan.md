

## Plan: Fix Recruiter Data + Enhance Recruiter Tree with Org Structure Labels

### Part 1 — Data Fix

Both Quinn Gleed and Calvin Schofield have `recruiter_user_id` set to Calvin's user ID (`843dac61...`) in the `recruits` table. Since their actual recruiter (Gunnar Bramwell) has no app account yet, both records should be set to `null` until Gunnar onboards.

**Action:** Use the insert tool to run:
```sql
UPDATE recruits SET recruiter_user_id = NULL
WHERE id IN (
  'e4391452-5901-4d2c-91d6-c8e40a87aaa7',  -- Quinn Gleed
  '3aebae30-f1cf-484c-b240-71468a285e01'   -- Calvin Schofield
);
```

This will remove both from appearing as each other's recruits in the tree. When Gunnar creates his account and his invite chain is established, their `recruiter_user_id` will be set correctly.

---

### Part 2 — Enhance the Recruiter Tree Tab with Org Structure Context

Keep both tabs (Recruiter Tree + Structure), but overlay formal organizational labels onto the recruiter tree so you can see where MGMT Groups and Teams sit within the lineage.

**Changes to `OrgChart.tsx` and `VisualRecruiterTree.tsx`:**

1. **Annotate tree nodes with their formal org role**: The existing `roleMap` already tags Team Leads, MGMT Group Leads, and Area Directors. Extend this to also include the **name of the entity** they lead (e.g., "Quinn Gleed MGMT" instead of just "MGMT Group Lead").

2. **Add visual grouping indicators on the tree**: When a node is a MGMT Group Lead or Team Lead, render a subtle background boundary or colored label beneath their avatar showing their group/team name. This makes it visually clear which branch of the recruiter tree corresponds to which formal group.

3. **Show team membership badges on leaf nodes**: For recruits who belong to a formal team, show a small team badge (e.g., "Team Alpha") below their name so you can see the formal structure overlaid on the organic recruiting chain.

**Technical details:**

- In `OrgChart.tsx` `roleMap` builder (lines 67-82): look up the team/mgmt group name for each lead and combine it with the role label, e.g. `"Quinn Gleed MGMT"` or `"Team Bravo Lead"`.
- In `VisualRecruiterTree.tsx`: add a new optional `teamName` or `groupName` field to `TreeNode`. Render it as a small pill/badge beneath the role label (lines 308-313).
- Pass `team_id` and `mgmt_group_id` data through the tree nodes so leaf recruits also show their team affiliation.

This approach preserves the recruiting lineage as the primary structure while making it immediately obvious how formal teams and MGMT groups map onto it.

