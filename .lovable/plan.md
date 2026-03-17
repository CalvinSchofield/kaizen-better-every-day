

# Reimagining the Blitzes Page — Event-First Mobile Design

## Current Problem
The page is a generic "card stack" layout: hero greeting → alert cards → blitz management card buried at the bottom. Every element competes equally for attention. The VetBlitzCard (1800 lines) contains the actual value but it's just another card in a pile.

## Design Philosophy
Think **Apple Wallet meets Airbnb Trips** — each blitz is an immersive, tactile "pass" or "trip card" that dominates the viewport. Alerts become subtle inline banners, not full competing cards.

## New Layout Structure

```text
┌─────────────────────────┐
│  Next Blitz Hero        │  ← Full-width immersive countdown
│  "Salt Lake City"       │     with location name as headline
│  ⏱ 12 days  │ ☀️ 78°   │     countdown + weather inline
│  [I'm In]  [Details]    │     RSVP integrated, not separate
├─────────────────────────┤
│ ⚠ 2 reps need attention │  ← Compact alert banner (tap to expand)
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │ 🔥 Active Challenge │ │  ← Small pill/banner, not a full card
│ └─────────────────────┘ │
├─────────────────────────┤
│  YOUR BLITZES           │  ← Section header
│ ┌─────────────────────┐ │
│ │ Salt Lake City      │ │  ← Blitz "pass" card — large, tactile
│ │ Jun 14-21 • 12 days │ │     tap to expand for accommodations,
│ │ ✓ Committed         │ │     team roster, logistics
│ │ 8 reps going        │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ Denver              │ │  ← Next blitz pass
│ │ Jul 5-12 • 33 days  │ │
│ │ ○ Not committed     │ │
│ └─────────────────────┘ │
├─────────────────────────┤
│  PAST BLITZES (2)    ▸  │  ← Collapsed, minimal
└─────────────────────────┘
```

## Specific Changes

### 1. Hero → Immersive Next-Blitz Countdown
Replace the generic "Good morning, Jake" greeting with the **next blitz as the hero itself**. Location name becomes the headline. Countdown, weather pill, and RSVP buttons are all integrated into one cohesive block. If no upcoming blitz is committed, the hero becomes a CTA to pick one. Keep the greeting as a subtle subline above.

### 2. Alerts → Compact Banners
`VetAlertCard`, `LeaderRookieReviewCard`, `PendingInstallAlertCard`, and MNL alert become small, tappable banner strips (single row, icon + text + chevron) instead of full cards. They sit between hero and blitz list. Tapping opens the existing drawers/sheets. This reclaims massive vertical space.

### 3. Blitz List → "Trip Pass" Cards
Instead of the VetBlitzCard's current collapsible card-within-card pattern, each blitz becomes its own standalone "pass" card:
- Large rounded card with subtle gradient or accent color on the left edge
- Location name prominent, date range, days-until countdown badge
- Commitment status as a pill (Committed / Not committed / Declined)
- Attendee count ("8 reps going") as social proof
- Tap to expand inline or open a detail sheet showing: accommodations (map, wifi, door code), team roster for that blitz, your scope assignments
- Swipe-friendly, feels like scrolling through Airbnb trips

### 4. Active Challenges → Inline Pill
The `ActiveChallengesCard` becomes a small highlighted pill/banner between alerts and blitz list. One line: "🔥 Sprint Challenge — 3 days left". Tap opens existing challenge detail.

### 5. Past Blitzes → Collapsed Section
A collapsible "Past Blitzes (N)" section at the bottom with muted styling. Already attended, minimal chrome.

## Implementation Approach

1. **Redesign `Blitzes.tsx`** — restructure the layout from card-stack to hero + banners + pass-list
2. **Create `BlitzPassCard.tsx`** — new component for each blitz "pass" with expandable detail
3. **Create `AlertBanner.tsx`** — compact single-line alert component replacing full cards
4. **Refactor hero section** — merge greeting, RSVP, countdown, and weather into one immersive block
5. **Slim down VetBlitzCard usage** — extract the per-blitz rendering into BlitzPassCard, keep team management logic

The VetBlitzCard's scope/team/commitment management logic stays but gets reskinned into the new pass card pattern rather than being one monolithic card.

