

## Tools Page Redesign — On-the-Door Resource Hub

### Current State
The Tools page has 4 sections:
1. **Sales Resources** — Competitor Cheat Sheet, Upgrade Cheat Sheet, Objections, Package Builder, Useful Contacts
2. **Team Info** — About the Team, Team Calendar, FAQ (coming soon)
3. **Vivint Portals** — Training Portal, Insider, Curator, Source
4. **Stay Connected** — Instagram links + embed
5. **Need Help?** — Call leader + AI Assistant link

### What Changes

**Remove:**
- "Stay Connected" (Instagram section) — entirely gone
- "Team Info" section — hide About the Team, Team Calendar, FAQ (keep files, just remove from page)
- "Need Help?" AI Assistant button — gone
- Current "Call Leader" implementation (uses static `team_leader` field)

**Keep & Elevate:**
- **Sales Resources** — promoted to hero-level quick-access grid
- **Vivint Portals** — kept, placed lower as a utility section

**Add:**
- **"Need Help?" floating contact bar** — smart upline resolution: walks up the recruiter chain via `recruiter_user_id` until finding a Sophomore or Vet (skips fellow Rookies). Shows simple Call + Text buttons for that person.

### New Layout Vision

```text
┌──────────────────────────────────┐
│  🔧 On the Doors                │  ← page title
├──────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐     │
│  │Shield│ │ ↑Up  │ │ 💬   │     │  ← 2x3 icon grid
│  │Comps │ │grade │ │Objctn│     │     tappable cards
│  └──────┘ └──────┘ └──────┘     │     with icon + label
│  ┌──────┐ ┌──────┐ ┌──────┐     │
│  │ 🧮   │ │ ☎️   │ │ 📦   │     │
│  │PkgBld│ │Contct│ │Prodct│     │
│  └──────┘ └──────┘ └──────┘     │
├──────────────────────────────────┤
│  Vivint Portals                  │  ← compact list
│  Training · Insider · Curator ·  │
│  Source                          │
├──────────────────────────────────┤
│  Need Help?                      │
│  Call [Upline Name]  Text [Name] │  ← smart upline
└──────────────────────────────────┘
```

### Technical Approach

#### 1. Smart Upline Resolution
Create a new hook `useUplineContact` that:
- Takes the current user's `user_id`
- Queries `recruits` table to find the record where this user is the recruit, gets `recruiter_user_id`
- Looks up that recruiter's `year` in the `reps` table
- If year is `Rookie`, follows that recruiter's own `recruiter_user_id` up the chain
- Stops when it finds a `Sophomore`, `Vet`, or any non-Rookie (or exhausts the chain)
- Returns `{ name, phone, year }` for the contact bar

This requires a recursive lookup. Best done as a small edge function or a client-side recursive query (max ~5 hops). Client-side approach with sequential queries is simplest given the shallow depth.

#### 2. Tools Page Rewrite (`src/pages/Tools.tsx`)
- **Hero grid**: 2-column or 3-column grid of large tappable cards with icons, labels, and subtle descriptions. Each card navigates to its existing route (`/tools/competitors`, `/tools/upgrades`, etc.)
- **Vivint Portals**: Compact horizontal scroll or small list cards with external link icons
- **Need Help bar**: Fixed or inline at bottom. Uses `useUplineContact` hook. Two buttons: Call + Text. Shows upline's first name and role badge (e.g., "Vet").
- Remove all Instagram/socials code
- Remove Team Info section rendering (keep About Team page/files intact)

#### 3. Files to Create/Modify

| File | Change |
|---|---|
| `src/hooks/useUplineContact.ts` | **Create** — recursive upline lookup hook |
| `src/pages/Tools.tsx` | **Rewrite** — new grid layout, remove Instagram/Team Info/AI, add smart help bar |

#### 4. Visual Design
- Grid cards: `rounded-2xl`, subtle border, icon centered with muted background circle, label below
- Warm, clean aesthetic with gentle hover/active states
- Need Help section: accent gradient background card, prominent but not overwhelming
- Vivint Portals: smaller, utilitarian styling to differentiate from primary tools
- Smooth entrance animations with staggered `framer-motion`

