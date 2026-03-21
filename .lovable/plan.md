
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

## Phase 3: Expanded Role Hierarchy (NEXT)

### TODO:
- Expand roles: assistant_manager, regional, sr_regional, partner, divisional
- Permission matrix per role
- My Group access for assistant managers (downline-based)
- Corporate admin panel for office/AD management
