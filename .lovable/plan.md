
Goal: fix the two persistent org-chart mismatches by making every org view use the same placement rules instead of three different implementations.

What the audit found:
1. The tabs are not using one source of truth.
   - `src/pages/OrgChart.tsx` builds the Recruiter Tree from recruiting lineage, then manually injects office leaders for ADs.
   - `src/components/org/OrgStructureTree.tsx` builds the Structure tab from formal org assignments (`team_mgmt_groups`, office links, etc.).
   - `supabase/functions/fetch-team-access/index.ts` uses name-based heuristics (`team_leader`, first-token matching, recruiter-chain tracing) to infer team/MGMT placement.
2. That mismatch explains both bugs:
   - Misael can appear as a separate branch in one view while also living under Quinn in the formal structure.
   - Christopher Mevs / Marek / Boonk can disappear or move between views when one path uses formal assignment and another path “guesses” placement from names or lineage.
3. The current logic also does not consistently honor the office-assignment hierarchy:
   `Rep office > Team office > MGMT Group office > Sr MGMT Group office`.
   That is especially risky for Christopher Mevs MGMT because it spans multiple offices.

Implementation plan:
1. Create one shared org-placement resolver
   - Add a shared utility that computes, for every rep/recruit:
     - effective office id
     - formal team id/name
     - formal MGMT group id/name
     - whether they are a team lead or MGMT lead
   - Use canonical data only: `recruits.team_id`, `recruits.mgmt_group_id`, `team_mgmt_groups`, entity lead ids, and office inheritance.
   - Remove name-token guessing as the primary placement method.

2. Refactor the Recruiter Tree tab to use that resolver
   - Update `src/pages/OrgChart.tsx` so AD office-scoped branches are grouped from canonical formal placement, not by appending “extra office leaders” as separate roots.
   - Dedupe by formal container + user id so Misael cannot show both as his own detached branch and under Quinn.
   - Ensure Christopher’s branch is included whenever the reps are formally in that MGMT/team scope, even if recruiting lineage is imperfect.

3. Refactor the Structure tab to use the same resolver
   - Update `src/components/org/OrgStructureTree.tsx` so team/member rendering and office grouping use the exact same effective office + formal placement logic as the Recruiter Tree.
   - This keeps Quinn/Misael and Christopher/Marek/Boonk consistent across both tabs.

4. Fix backend access-scope logic so downstream views stay aligned
   - Update `supabase/functions/fetch-team-access/index.ts` to stop inferring placement from first-name matches and recruiter/team-leader strings.
   - Build `accessibleReps` from the shared formal placement model instead.
   - This prevents the same bad grouping from leaking into drawers, filters, and any other org-related UI.

5. Sweep secondary org components that still have custom tree logic
   - Audit and align any remaining org views/components that build their own hierarchy independently, especially:
     - `src/components/mygroup/org/RecruiterTreeView.tsx`
     - `src/components/mygroup/OrganizationManagementView.tsx`
   - If they stay separate, the bug will reappear elsewhere even after fixing `/org-chart`.

Technical details:
- Most likely direct cause of the Christopher/Misael inconsistency:
  - `fetch-team-access` currently relies on `normalizeFirstToken(team.name)`, `rep.team_leader`, and recruiter-chain tracing.
  - `OrgChart.tsx` AD logic adds office leaders as extra roots instead of deriving all branches from one resolved placement map.
  - `OrgStructureTree.tsx` uses formal tables, so it can disagree with both.
- No database schema changes are needed.
- This should be treated as a data-resolution bug, not a visual bug.

Validation after implementation:
1. In both tabs, confirm Misael appears only inside Quinn Gleed MGMT and nowhere as a duplicate peer branch.
2. Confirm Christopher Mevs MGMT appears consistently in both tabs.
3. Confirm Marek and Boonk appear under Christopher’s branch in both tabs when their formal assignments say they should.
4. Confirm split-office MGMT groups only show the reps actually assigned to the AD’s office.
5. Re-test the Group by Office toggle and regular structure view to ensure counts and branch placement still match.
