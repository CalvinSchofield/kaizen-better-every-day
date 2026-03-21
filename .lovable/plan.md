# Scaling Kaizen Beyond Your Office: Architecture Plan

## The Problem

The app currently assumes a single office (yours), with you hardcoded as the area director. Every rep, team, and MGMT group exists within your org. To onboard other Vivint groups, we need:

1. **Self-service onboarding** — new reps join via invite links, not manual leader entry
2. **Multi-office support** — multiple area directors, each with their own org
3. **Expanded role hierarchy** — assistant managers, regionals, sr. regionals, partners, divisionals, corporate
4. **Office scoping** — data isolation so leaders only see their office/downline

---

## Key Questions Before Implementation

Before building, I need clarity on a few things:

### 1. Role Progression & Permissions

- **Assistant Managers**: Do they get the same "My Group" leadership view as team leads, or a lighter version? Do they have any admin capabilities (creating blitzes, incentives)? ANSWER: the my group page shows downline based on the recruiter tree, and yes they should have my group access and leadership view. They shouldn't be able to create blitzes, but incentives and competitions and all that they can create for their group with admin authority. If there are more questions about this let me know. 
- **Regionals / Sr. Regionals / Partners / Divisionals**: Are these essentially "bigger area directors" who oversee multiple offices? Or do they map to the MGMT group lead level within a single office? ANSWER: yes they are buffed or higher up. Regionals have multiple MGMT leaders they are in charge of. Remember area director is a seperate title that doesn't fit in this hierarchy. Can you send me your service number? You can find it on your app by clicking the top left three lines and then click support or “premium support”. Send me the number not a screenshot so I can copy and paste it! Area director is simply a leader of a bucket called an "office", which usually consists of multiple MGMT groups or at least multiple teams often. But regionals are in charge of multiple area directors. 
- **Corporate**: Do they literally see every office in the entire system? Is there a specific corporate dashboard, or do they just get the same views with an "all offices" scope? ANSWER: for now, they see everything. All offices

### 2. Office Boundaries

- You mentioned area directors are sometimes over reps NOT in their recruiting tree. How does an office get populated? Is it purely "AD assigns teams to their office"? Or is it geographic? ANSWER: regionals or people above MGMT group leaders and area directors create offices and assign area directors to offices. They also determine which groups/reps go to which office under which area director. It is not geographical. 
- Can a rep belong to one office but have a recruiter in a different office? (Cross-office recruiting) ANSWER: yes potentially. Like for example I defined in-app a different MGMT group that will join our office. I am not at the top of the upline and they are not in my downline but I will be in charge of this group of reps/teams for the summer. 

### 3. Invite Link Flow

- When someone signs up via an invite link, should they go straight into the app as a "rep" in selling stage? Or should they start as a "recruit" that the recruiter then promotes? ANSWER: if someone is sharing the app with a recruit, they are signing up and moving forward so they should get app access as a rep that is "signed"
- Should the invite link capture any info beyond the recruiter relationship (e.g., which team they're on, their year/experience level)? ANSWER: not sure but probably would make sense for them to answer things like first and last name, email, year (rookie, sophomore, vet), which team they're on (based on which team the recruiter is on and as defined in the organizational structure -- for example if I am a team lead and invite someone, they just confirm they're on my team because I have a team defined called "Calvin Schofield's Team"). 

### 4. Recruiter Reassignment

- When a rep's recruiter changes, should their entire downline move with them, or just the individual? ANSWER: the entire downline moves with them. For example: if Adam schofield left Vivint next year and Ammon's recruiter became Calvin Schkdield, then everyone Ammon recruited goes with him -- Ammon is still the recruiter but now that's the branch connection
- Who can change recruiter assignments? Only the AD, or also team leads/MGMT leads? ANSWER: only the upline OR it can be assigned to someone in that current recruiters downline. For example, if Ammon recruits someone, he is listed automatically as the recruiter. Ammon can assign a new recruiter to the rep, but only someone in his downline. He can't assign the rep to a different recruiter somewhere else in the org. Also his upline (Adam, myself) can reassign the recruiter to someone else in THEIR downline

---

## Proposed Architecture

### Phase 1: Invite-Based Onboarding (Highest Impact)

**Database Changes:**

- Add `invite_codes` table: `id`, `code` (unique short string), `inviter_user_id`, `team_id` (optional), `created_at`, `expires_at`, `uses_count`
- Add `invite_code` column to `reps` table to track how they joined

**Auth Flow Changes:**

- Auth page accepts an optional `?invite=CODE` query param
- On signup with invite code: automatically create the recruit record linked to the inviter, create the rep record, and grant app access — no manual "Add Recruit" step needed
- SetupFlow enhanced to ask the new rep a few questions (year/experience, phone number) during onboarding
- My Group page gets a "Share Invite Link" button that generates/copies the recruiter's unique link

**Key Benefit:** Eliminates the manual "Add Recruit" bottleneck. The recruiting tree builds itself organically.

### Phase 2: Multi-Office Support

**Database Changes:**

- New `offices` table: `id`, `name`, `location`, `created_at`
- New `office_staff` table: `office_id`, `user_id`, `role` (area_director, etc.) — replaces `area_directors` table concept
- Add `office_id` to `teams` table (every team belongs to an office)
- Add `office_id` to `mgmt_groups` table

**Access Control Changes:**

- `fetch-team-access` gains office awareness: ADs see all teams in their office
- New scope level: "office" is scoped to the AD's assigned office, not "everything"
- Corporate role sees all offices

### Phase 3: Expanded Role Hierarchy

**Database Changes:**

- Expand role system: `recruit → rep → assistant_manager → team_lead → mgmt_lead → regional → sr_regional → partner → divisional → corporate`
- Each role maps to specific permission sets (which views they access, what scope they see)

**Permission Matrix:**

```text
Role               | My Group | Reports | Blitzes | Org Tab | Scope
─────────────────────────────────────────────────────────────────────
Rep                | Own only | Self    | View    | No      | Self
Asst Manager       | Downline | Team    | View    | No      | Recruits
Team Lead          | Team     | Team    | Manage  | Yes     | Team
MGMT Lead          | Groups   | Groups  | Manage  | Yes     | MGMT Groups
Area Director      | Office   | Office  | Manage  | Yes     | Office
Regional+          | Multi-Off| Region  | Manage  | Yes     | Multiple Offices
Corporate          | All      | All     | Manage  | Yes     | Everything
```

---

## Things You May Not Be Thinking About

1. **Ghost rep migration**: Existing ghost reps (synced from Notion without accounts) need a path to claim their records when they sign up via invite links. The current email/phone matching logic helps, but invite codes make this cleaner.
2. **Office bootstrapping**: How do you onboard the first AD of a new office? Someone with corporate access needs to create the office and assign the AD. This means building a minimal corporate admin panel.
3. **Cross-office visibility**: If a regional oversees 3 offices, leaderboards and reports need an office filter. The current single-scope model needs a multi-scope selector.
4. **Invite link abuse**: Need rate limiting and optional approval. A rep's invite link could be shared publicly. Consider: invite links create the recruit record but the recruiter still has to "approve" them before full access is granted.
5. **Data migration**: Your current 70+ reps need to be assigned to an office. This is a one-time migration but needs to be planned.
6. **Recruiter changes and tree integrity**: When you reassign a recruiter, the downstream tree can break. Need clear rules about whether the subtree moves or stays.

---

## Recommended Build Order

1. **Invite links** (Phase 1) — unblocks organic growth immediately
2. **Offices table + AD assignment** (Phase 2a) — structural foundation
3. **Scope fetch-team-access to offices** (Phase 2b) — data isolation
4. **Corporate admin panel** (Phase 2c) — office/AD management
5. **Expanded roles** (Phase 3) — assistant managers, regionals, etc.

This is a large effort. I'd suggest we tackle Phase 1 (invite links) first since it solves the most immediate pain point: getting people into the app without manual entry. Want me to scope Phase 1 in detail and start building?