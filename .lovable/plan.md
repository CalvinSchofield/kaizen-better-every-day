

# Restructure Home Page When Knocking Mode is OFF

## Summary
Replace the current "Home" (`/`) with role-based redirects and a new dedicated **Blitzes** page. Pre-blitz Rookies keep their ramp journey as-is. Everyone else lands on a purpose-built page.

## Routing Changes (`Home.tsx`)

When knocking mode is OFF:
- **Leaders** (Vet/Soph with team access): `<Navigate to="/blitzes" replace />` -- My Group stays as the action button in nav (already working)
- **Post-blitz Rookies & non-leader Vets/Sophs**: `<Navigate to="/blitzes" replace />`
- **Pre-blitz Rookies**: Keep current ramp journey render (no change)

## New `/blitzes` Page

Create `src/pages/Blitzes.tsx` by extracting and consolidating blitz-related content from `VetHome.tsx` and `PostBlitzRookieHome.tsx`:

- **Blitz RSVP / countdown** (the next-blitz hero card with days countdown, weather CTA)
- **Blitz commitment list** (commit/uncommit to upcoming blitzes with confirmation drawers)
- **Weather sheet** for upcoming blitz location
- **Active challenges card** (`ActiveChallengesCard`)
- **Pending install alerts** (`PendingInstallAlertCard`)
- **Recap CTA** (`RecapCTACard`)
- **Leader alerts** (`VetAlertCard`, `LeaderRookieReviewCard`) -- shown only for leaders

Cut: `RecruitingFlowCarousel`, static 5-5-5, "Bring a Friend", `YourProgressCard` (available elsewhere), `LeaderboardCTA` (leaderboard is in nav)

## Navigation Changes (`Layout.tsx`)

When knocking mode is OFF:
- **Leaders**: Replace `{ path: "/", icon: Home, label: "Home" }` with `{ path: "/blitzes", icon: Calendar, label: "Blitzes" }`. Action button stays `My Group`.
- **Non-leader Vets/Sophs/Post-blitz Rookies**: Same -- replace Home with `{ path: "/blitzes", icon: Calendar, label: "Blitzes" }`. Action button stays `Training`.
- **Pre-blitz Rookies**: Keep `{ path: "/", icon: Home, label: "Home" }` since their ramp journey still lives at `/`.
- Update `getPageTitle()` to include `"/blitzes": "Blitzes"`.

## App.tsx

Add route: `<Route path="/blitzes" element={<ProtectedRoute><Layout><Blitzes /></Layout></ProtectedRoute>} />`

## Cleanup

After the Blitzes page is working:
- Delete `src/components/VetHome.tsx` (~1009 lines)
- Delete `src/components/PostBlitzRookieHome.tsx` (~1008 lines)
- Remove imports from `Home.tsx` and the conditional renders for these components (lines 1026-1033)
- Home.tsx shrinks to: loading state, no-rep-data state, intro wizard, knocking mode redirect, blitzes redirect, and the pre-blitz rookie ramp journey

## Implementation Order

1. Create `Blitzes.tsx` with consolidated blitz content
2. Register `/blitzes` route in `App.tsx`
3. Update `Layout.tsx` nav items to show "Blitzes" instead of "Home"
4. Update `Home.tsx` to redirect leaders and post-blitz users to `/blitzes`
5. Delete `VetHome.tsx` and `PostBlitzRookieHome.tsx`, clean up `Home.tsx` imports

