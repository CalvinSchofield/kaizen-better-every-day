
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

### How it works:
- Leader opens My Group → taps "Invite Rep" → gets a unique link like `kaizen.app/auth?invite=ABC123`
- New rep opens link → signs up → sees onboarding form (name, phone, year) → "Join My Team" → auto-creates recruit+rep records linked to the inviter
- If the email matches a ghost rep, it claims that existing record instead of creating a duplicate
- The recruiting tree builds itself organically

## Phase 2: Multi-Office Support (NEXT)

### TODO:
- Create `offices` table
- Create `office_staff` table (replaces `area_directors` concept)
- Add `office_id` to `teams` and `mgmt_groups`
- Update `fetch-team-access` for office awareness
- Corporate role sees all offices

## Phase 3: Expanded Role Hierarchy (LATER)

### TODO:
- Expand roles: assistant_manager, regional, sr_regional, partner, divisional, corporate
- Permission matrix per role
- My Group access for assistant managers (downline-based)
