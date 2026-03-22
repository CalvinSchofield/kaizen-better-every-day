## Issues Identified and Plan

### Issue 1: Marek's recruit detail drawer shows stale recruiter/team info

**Root cause**: The `recruitLookup` in `OrgChart.tsx` (lines 264-284) reads `recruiterName` and `teamName` directly from the `recruits` table data (`recruiter_user_id` and `team_id`). If Marek's recruit record wasn't updated when he was moved under Christopher Mevs MGMT as a team lead, the drawer still shows old values (you as recruiter, your team name).

**Fix**: When a node is tapped in the Org Chart recruiter tree, the drawer should cross-reference the **current** organizational structure (teams/mgmt_groups tables) to resolve team lead and recruiter info, not just rely on the static `recruits` record. Specifically:

- Check if the person is a team lead via the `teams` table — if so, show their MGMT group context
- Look up their actual `recruiter_user_id` from the recruits table (this should already be correct if the recruiter was reassigned; if it wasn't, the data needs updating in the DB)

**Action**: Verify that when Marek was assigned as team lead under Christopher Mevs MGMT, his `recruits.recruiter_user_id` and `recruits.team_id` were also updated. If the Structure tab move didn't trigger a recruiter update prompt (or it was skipped), the recruit record is stale. The fix is two-fold:

1. Ensure lineage moves in the Structure tab always update `recruiter_user_id` and `team_id` on the recruit record (check `manage-org-request` edge function)
2. In the `recruitLookup`, overlay team/MGMT info from the formal structure tables when the person is a known leader

### Issue 2: Org Chart visibility — what you see as MGMT Lead + Area Director

**Current code behavior** (lines 215-241): When `accessLevel` is `area_director`, the tree shows ALL recruiter roots (any recruiter who was not themselves recruited). This is overly broad — it's showing the entire org, not scoped to your downline or your office.

**Your question**: "Is this just my downline?" — **No, currently it is not**. The `area_director` access level triggers the "show all root recruiters" path, which is the same as corporate. Since AD is not a lineage role, this is incorrect. The tree should show:

- Your **organic recruiting downline** (people you recruited, and their recruits)
- NOT Christopher Mevs or Quinn Gleed unless they are in your recruiting downline
- HOWEVER******** for area directors, they should be able to see everyone in their office. For example in my case (Calvin schofield), I am both a MGMT group leader and assigned the role of area director for the Yosemite 2026 office which includes people I didn't directly recruit, such as Quinn Gleed and his MGMT and Christopher Mevs and his MGMT. so since I am in their charge this summer, I should see all of Quinn Gleeds reps in his MGMT that are assigned to my office as well as all of Christophe Mevs MGMT reps that are assigned to my office. Not ALL reps in the MGMT, just any rep that is supposed to be in my office 

**Fix**: For `area_director` access level, use the same logic as a regular team lead/MGMT lead — build the tree starting from `currentAuthUserId` only. The AD role should not expand visibility in the recruiter tree.

### Issue 3: Page access for team leads / recruiters

**Current code**: The nav item (`AppDrawer.tsx` line 359) shows the "Organization" link for `team_lead+` (via `canManageTeam`). The page itself (`OrgChart.tsx` lines 242-248) falls through to building a tree from `currentAuthUserId` for non-AD/non-corporate users.

**Current behavior**:

- Team leads: YES, they see the page and their own downline tree
- Regular recruiters (not team lead): They do NOT see the nav link (hidden by `canManageTeam`)
- MGMT leads and above: YES

**Your question about pipeline stages**: Currently the recruiter tree only shows `SIGNED_PLUS_STAGES` (Signed, Shadow, Sold, Sold 5+). You want team leads to also see pipeline recruits (Reached Out, Evaluating) so the page is useful to them.

### Plan Summary

1. **Fix recruiter tree visibility for Area Directors** — Change the `area_director` access level to use the personal downline path (`buildNode(currentAuthUserId)`) instead of the "show all roots" path. ADs should only see their organic recruiting downline on the Recruiter Tree tab.
2. **Fix stale recruiter/team info in recruit detail drawer** — In the `recruitLookup` builder, cross-reference the `teams` and `mgmt_groups` tables to overlay current organizational assignments (team name from team_id, recruiter from recruiter_user_id). Also verify that the `manage-org-request` edge function updates `recruiter_user_id` when a rep is moved between teams.
3. **Show pipeline recruits for team leads** — When the current user's access level is `team_lead`, expand the stage filter to include `REACHED_OUT` and `EVALUATING` in addition to `SIGNED_PLUS_STAGES`. This gives team leads visibility into their pipeline. MGMT leads and above continue to see only signed+ to avoid noise.

### Technical Details

**File changes:**

- `src/pages/OrgChart.tsx`:
  - Lines 215-221: Remove `area_director` from the "show all roots" condition
  - Lines 242-248: The `else if` branch already handles building from `currentAuthUserId`, so ADs will fall into this path
  - Lines 100-103: Conditionally include pipeline stages when `teamAccess?.accessLevel === 'team_lead'`
- `src/components/mygroup/recruit-detail/RecruitHeader.tsx` / `RecruitDetailDrawer.tsx`: Potentially update to fetch fresh team/recruiter data from the org structure rather than relying solely on the passed `recruit` prop
- Verify `manage-org-request` edge function updates `recruits.recruiter_user_id` and `recruits.team_id` when moving reps between teams