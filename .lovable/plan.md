# Secure Role Assignment and Org Creation Permissions

## Problem Summary

Three issues need addressing:

1. **Role assignment is wide open**: The pending approval drawer passes `isBootstrapApproval={true}` for ALL approvals, letting any MGMT Lead+ assign ANY role (including Corporate/Divisional). A rookie who invites a friend could have their MGMT Lead assign that friend as "Divisional" — no guardrails.
2. **RLS blocks non-corporate leaders**: The new hierarchy tables (sr_mgmt_groups, sr_regions, partners, divisions) only allow `is_corporate()` to insert/update/delete. A Sr Regional assigned that role can't actually create their own sr_region or regions inside it.
3. **Create buttons only show for Regional+**: The top-level "Create" buttons are gated by `canManageRegions` (regional+). Mid-level leaders (Sr MGMT Group leads, Senior Managers) can't create entities at their own level through long-press context menus either without the right access checks.

## Plan

### 1. Restrict Role Assignment to Downline-Only (Security Fix)

**File**: `src/components/mygroup/recruit-detail/EditRecruitDrawer.tsx`

- Remove unconditional `isBootstrapApproval` behavior
- Change the role filter logic:
  - **Normal flow**: Approver can only assign roles **strictly below** their own access level (already works: `ROLE_HIERARCHY.indexOf(role) < ROLE_HIERARCHY.indexOf(accessLevel)`)
  - **Bootstrap flow** (inviting your upline): Only allowed when the approver explicitly initiated an "upward invite" — detect this by checking if the recruit's `recruiter_user_id` matches the current user AND the recruit has no existing role. Keep the bootstrap flag but only pass it from PendingApprovalsSection when the inviter IS the current user.

**File**: `src/components/mygroup/PendingApprovalsSection.tsx`

- Change `isBootstrapApproval` from always-true to conditional: only true when the current user is the direct inviter (recruiter_user_id matches) AND the current user's access level is below the role being assigned. This preserves upward onboarding while preventing lateral/downward abuse.

### 2. Update RLS Policies for Hierarchy Tables (Database Migration)

Add policies so leaders can manage entities at their own level:

```sql
-- Sr MGMT Groups: area_director+ can manage (they house mgmt_groups)
CREATE POLICY "Area directors can manage sr_mgmt_groups"
  ON public.sr_mgmt_groups FOR ALL TO authenticated
  USING (public.is_area_director(auth.uid()))
  WITH CHECK (public.is_area_director(auth.uid()));

-- Regions: regional+ can manage
-- (regions table already has policies, but may need INSERT for sr_regional+)

-- Sr Regions: sr_regional+ (use is_corporate OR lead_user_id match)
CREATE POLICY "Sr regional leads can manage their sr_regions"
  ON public.sr_regions FOR ALL TO authenticated
  USING (lead_user_id = auth.uid())
  WITH CHECK (lead_user_id = auth.uid());

-- Partners: partner leads can manage
CREATE POLICY "Partner leads can manage their partners"
  ON public.partners FOR ALL TO authenticated
  USING (lead_user_id = auth.uid())
  WITH CHECK (lead_user_id = auth.uid());

-- Divisions: divisional leads can manage
CREATE POLICY "Division leads can manage their divisions"
  ON public.divisions FOR ALL TO authenticated
  USING (lead_user_id = auth.uid())
  WITH CHECK (lead_user_id = auth.uid());
```

Also add broader insert policies so higher-level leaders can create child entities (e.g., a partner lead needs to create sr_regions under their partnership).

### 3. Tiered Create Button Visibility

**File**: `src/components/org/OrgStructureTree.tsx`

Instead of one `canManageRegions` gate showing ALL create buttons, show level-appropriate buttons:


| Access Level                                                                                                                                                                                                                                                                                                                             | Can Create                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| mgmt_group_lead                                                                                                                                                                                                                                                                                                                          | Teams (via long-press on their MGMT group) |
| senior_manager ****WRONG: area directors should not have access to all this that a sr manager has. Area director is a role or job title that has nothing to do with lineage and should not have this ability to create MGMT groups, sr mgmt groups etc. their ability to create stuff has nothing to do with them Being an area director | MGMT Groups, Sr MGMT Groups, Teams         |
| regional                                                                                                                                                                                                                                                                                                                                 | + Offices, Refions                         |
| sr_regional                                                                                                                                                                                                                                                                                                                              | + Sr Regions                               |
| partner                                                                                                                                                                                                                                                                                                                                  | + Partnerships                             |
| divisional                                                                                                                                                                                                                                                                                                                               | + Divisions                                |
| corporate                                                                                                                                                                                                                                                                                                                                | Everything                                 |


Each level sees create buttons for their level and below. Long-press context menus already handle child creation (e.g., long-press Division → Create Partnership), so the top-level buttons just need tiered gating.

### 4. Who Can Assign Roles — Summary


| Approver Level                                                                                                          | Can Assign Roles                                  |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| MGMT Group Lead                                                                                                         | Recruiter, Assistant Manager, Team Lead           |
| Senior Manager                                                                                                          | + Manager                                         |
| Area Director+ ****WRONG: area directors don't get any capabilities related to lineage like this. It's just a job title | __                                                |
| Regional                                                                                                                | +sr manager                                       |
| Sr Regional                                                                                                             | + Regional                                        |
| Partner                                                                                                                 | + Sr Regional                                     |
| Divisional                                                                                                              | + Partner                                         |
| Corporate                                                                                                               | All roles                                         |
| **Bootstrap (upward invite)**                                                                                           | Any role (one-time, only when you're the inviter) |


This ensures a rookie can't assign their friend as Divisional, because rookies have no access level and can't even see the role assignment UI (`canAssignRoles` requires mgmt_group_lead+).

### Technical Details

- The `canAssignRoles` check already requires `mgmt_group_lead+`, so regular reps/recruiters never see role assignment — the concern is really about mid-level leaders over-assigning
- Bootstrap approval is legitimate for the "invite your boss" flow but should be scoped to the inviter only
- RLS changes ensure server-side enforcement matches UI permissions
- No changes needed to the edge function approval chain — it already works correctly