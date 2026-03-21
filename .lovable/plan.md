
# Scaling Kaizen Beyond Your Office

## Phase 1: Invite-Based Onboarding ✅ IMPLEMENTED

### What was built:
1. **`invite_codes` table** — stores invite codes with `code`, `inviter_user_id`, `team_id`, `mgmt_group_id`, `uses_count`, `max_uses`, `expires_at`, `is_active`
2. **`invite_code_used` column** added to both `reps` and `recruits` tables for tracking
3. **`process-invite-signup` edge function** — validates invite code, creates recruit + rep records, links to inviter, increments usage counter, handles ghost rep claiming
4. **Auth page (`Auth.tsx`)** — accepts `?invite=CODE` query param, stores in sessionStorage, defaults to signup mode, shows "You've Been Invited!" messaging
5. **SetupFlow** — detects invite code, shows onboarding form (name, phone, year/experience), calls edge function to create records, then continues normal setup
6. **ShareInviteLinkButton** — drawer on My Group page header for leaders to generate/copy/share their unique invite link via Web Share API or clipboard
7. **RLS policies** on `invite_codes` — public read (for validation), authenticated CRUD scoped to own codes

## Phase 2: Multi-Office Support ✅ IMPLEMENTED

### What was built:
1. **`offices` table** — `id`, `name`, `location`, `created_at`, `updated_at`, `created_by`
2. **`office_staff` table** — `office_id`, `user_id`, `role` (area_director, corporate, etc.) with unique constraint
3. **`office_id` column** added to `teams` and `mgmt_groups` tables
4. **Security definer functions**: `is_office_staff()`, `is_corporate()`, `get_user_office_ids()`
5. **RLS policies** on offices/office_staff — viewable by authenticated, manageable by corporate/AD
6. **`fetch-team-access` updated**:
   - New `corporate` access level — sees ALL reps across all offices
   - `area_director` now scoped to their office(s) — only sees teams/groups/reps in assigned offices + their recruiter downline
   - Office IDs resolved via `get_user_office_ids()` function
7. **`useTeamAccess` type** updated to include `'corporate'`
8. **All 15+ components** updated to treat `corporate` alongside `area_director` for permissions
9. **Data migration**: Default office created, both current ADs assigned, all existing teams/groups linked

### How office scoping works:
- Area Directors are assigned to offices via `office_staff` table
- Teams and MGMT groups have `office_id` linking them to an office
- `fetch-team-access` queries the AD's office IDs, then only returns reps whose team/group belongs to those offices
- AD also gets their recruiter downline (even if cross-office)
- Corporate role bypasses all office scoping and sees everything

## Phase 3: Expanded Role Hierarchy ✅ IMPLEMENTED

### What was built:
1. **`user_roles` table** — stores explicit role assignments with `user_id`, `role` (app_role enum), `assigned_by`, unique constraint on (user_id, role)
2. **`app_role` enum** — `assistant_manager`, `regional`, `sr_regional`, `partner`, `divisional`, `corporate`
3. **`has_role()` function** — security definer to check if user has a specific role
4. **`has_min_role()` function** — security definer to check if user has a role at or above a given level
5. **Updated `is_corporate()` function** — now checks both `office_staff` AND `user_roles` tables
6. **Role hierarchy utility** (`src/utils/roleHierarchy.ts`):
   - `AccessLevel` type: `none → recruiter → assistant_manager → team_lead → mgmt_group_lead → area_director → regional → sr_regional → partner → divisional → corporate`
   - `hasMinAccess()`, `isLeader()`, `canManageTeam()`, `canManageBlitzes()`, `canFilterByTeam()`, `isGlobalAccess()`, `getRoleLabel()`
7. **Updated `fetch-team-access` edge function**:
   - Checks `user_roles` table for explicit role assignments
   - Assistant manager auto-detected: 3+ selling recruits in downline
   - Regional+ roles get global access (see all reps, like corporate)
   - Role priority: explicit roles > structural roles (team/mgmt lead) > dynamic roles (recruiter)
8. **Corporate Admin Panel** (`/admin`):
   - **Offices tab**: Create/delete offices, assign/remove staff (area directors, corporate roles)
   - **Roles tab**: Assign/remove explicit roles to any rep (assistant_manager through corporate)
   - Access restricted to corporate users only
9. **All 10+ component types updated** to use centralized `AccessLevel` type from `roleHierarchy.ts`
10. **Key permission checks updated** to use `hasMinAccess()` and `canFilterByTeam()` utilities

### How role detection works (priority order):
1. Check `user_roles` table for explicit assignments (corporate, regional, etc.)
2. Check `office_staff` for area_director
3. Check `mgmt_groups.lead_user_id` for mgmt_group_lead
4. Check `teams.lead_user_id` for team_lead
5. Dynamic: 3+ selling recruits → assistant_manager
6. Dynamic: any selling recruits → recruiter
7. Highest role wins

### Permission matrix:
```text
Role               | My Group | Reports | Blitzes | Admin | Scope
─────────────────────────────────────────────────────────────────────
Rep                | Own only | Self    | View    | No    | Self
Recruiter          | Downline | Self    | View    | No    | Recruits
Asst Manager       | Downline | Team    | View    | No    | Recruits
Team Lead          | Team     | Team    | Manage  | No    | Team
MGMT Lead          | Groups   | Groups  | Manage  | No    | MGMT Groups
Area Director      | Office   | Office  | Manage  | No    | Office
Regional+          | All      | All     | Manage  | No    | Everything
Corporate          | All      | All     | Manage  | Yes   | Everything
```

## Phase 4: Operational Features ✅ IN PROGRESS

### 4a. Recruiter Reassignment UI ✅ BUILT
- **Visual recruiter tree**: Beautiful circle-node tree diagram (inspired by family tree UIs) with:
  - Circle avatar nodes with color-coded borders by stage (Sold 5+ = purple, Sold = green, Shadow = blue, Signed = amber)
  - SVG connecting lines with right-angle junctions
  - Zoom/pan via react-zoom-pan-pinch (pinch-to-zoom on mobile)
  - Zoom controls (+, -, reset)
  - Child count badges on parent nodes
- **Tap-to-reassign UX**: Tap a node → reassignment drawer opens with searchable recruiter list
- **Branch move confirmation**: When reassigning someone with recruits, shows confirmation with count of affected downstream reps
- **Permissions**: Team Lead+ can reassign (updated `update-rep-assignment` edge function from area_director-only to team_lead+)
- **Components**: `VisualRecruiterTree.tsx`, `ReassignRecruiterDrawer.tsx`, updated `RecruiterTreeView.tsx`

### 4b. Blitz Cross-Group Invitations (TODO)
- **Scoping**: "Same region" = groups that share the same Regional in the hierarchy
  - Can invite any MGMT group or specific team/reps within the same Regional's downline
  - Cannot invite groups under a different Regional (even if they share the same Partner/Divisional)
- **Implementation approach**: Need to resolve which Regional a group belongs to by tracing upward through the hierarchy
- **UI**: Extend blitz creation to allow inviting external groups within the region

### 4c. Office Management for Regionals (TODO)
- Extend admin panel so Regionals can create/manage offices and assign ADs
- Currently only Corporate can access /admin

### 4d. Organizational Hierarchy Visualization (TODO)
- Full interactive org chart showing the formal hierarchy across offices
- Separate from the recruiter tree (shows offices → MGMT groups → teams → reps)

### 4e. Invite Improvements (TODO)
- Rate limiting (max invites per day/week)
- Approval workflow for new signups
- Invite analytics (conversion rates, active vs expired)
