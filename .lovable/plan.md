

# Redesign Pending Approval Screen

## Current Logic (Verified)
- `ProtectedRoute` checks `recruitApproval?.approval_status === 'pending'` and renders `PendingApprovalScreen`
- `isDirectGroup` = true if recruit's mgmt_group name contains "calvin" or "quinn" (i.e., your direct org)
- `showTeamInfoLink = !isDirectGroup` — non-direct recruits see external smarthomepros.com link; direct recruits see nothing extra
- Pending users are fully blocked from the app — they only see this one screen

## Plan

### 1. Redesign `PendingApprovalScreen.tsx` into a polished app showcase
Replace the current static "hang tight" screen with a scrollable, visually rich single page that sells the app:

**Hero section**: Welcome message + Kaizen branding + subtle "pending review" status indicator (not the focal point — more of a quiet badge/banner at top)

**Feature showcase cards** (scrollable, icon-driven, minimal text):
- **Set Goals** — daily/weekly/monthly targets
- **Make Plans** — schedule your knocking days
- **Track Inputs** — doors, pitches, closes in real-time
- **Learn & Improve** — see your numbers, spot trends
- **Live Leaderboard** — compete with your team
- **Challenges & Incentives** — start or join group competitions
- **Recruiting Platform** — build and manage your team
- **Customer CRM** — sales log and customer management

Each card: icon + 2-3 word title + 1-line description, using the app's existing primary/accent palette. Arranged in a 2-column grid with subtle entrance animations (framer-motion).

**Bottom section**: Team leader contact info (existing), iOS download prompt (existing), sign out button

### 2. About Team page integration for direct downline
- When `showTeamInfoLink` is false (meaning user IS in direct org), show a prominent "Meet the Team" button
- Clicking it renders the existing `AboutTeam` component inline (swap view via local state), with a back arrow button at the top to return to the main pending screen
- When `showTeamInfoLink` is true (NOT direct org), keep the external "Learn About the Team" link to smarthomepros.com

### 3. No routing changes needed
The entire experience stays within the `PendingApprovalScreen` component — no new routes. The AboutTeam page is rendered conditionally via state toggle, keeping pending users fully gated from the rest of the app.

### Files to modify
| File | Change |
|------|--------|
| `src/components/PendingApprovalScreen.tsx` | Full redesign: feature showcase, inline AboutTeam toggle, polished layout |

