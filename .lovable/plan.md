

# Home Page Polish and Persona-Aware UX Audit

## Current State Analysis

After a deep review of the codebase, here's what the home page currently looks like for each persona:

### Persona Routing (Home.tsx, 1862 lines)

```text
User arrives at Home
  |
  +--> No rep data? --> "Account Setup Needed" screen
  |
  +--> First visit? --> IntroWizard (per user type)
  |
  +--> Knocking Mode ON?
  |     +--> Vet/Sophomore --> KnockingModeHome (variant="vet")
  |     +--> Blitz-ready Rookie --> KnockingModeHome (variant="rookie")
  |     +--> Pre-blitz Rookie --> falls through (BUG - see below)
  |
  +--> Vet/Sophomore --> VetHome (recruiting-focused)
  |
  +--> Post-blitz unlocked Rookie --> PostBlitzRookieHome
  |
  +--> Pre-blitz Rookie --> Inline journey (onboarding, ramp phases, blitz cards)
```

### What Each Persona Sees Today

| Persona | Non-Knocking Home | Knocking Home |
|---------|------------------|---------------|
| **Brand new Rookie** (pre-onboarding) | Welcome message, onboarding steps, trainings, Slack intro | N/A (not eligible) |
| **Rookie in Ramp phases** (post-Slack) | Ramp Hero Section, blitz management, phase tasks | N/A (not eligible) |
| **Blitz-ready/Post-blitz Rookie** | PostBlitzRookieHome: progress card, blitz RSVP, recruiting | KnockingModeHome: DailyFocus, Activity, Leaderboard, Competitor cheat sheets |
| **Vet (non-leader)** | VetHome: recruiting flow carousel, blitz card, 5-5-5 CTA, challenges | KnockingModeHome: same as above, without competitor cards |
| **Leader (Vet/Soph)** | VetHome: VetAlertCard, team management, recruiting flow, blitz | KnockingModeHome: + LeaderRookieReviewCard |

---

## Issues Found

### 1. Knocking mode fall-through bug for pre-blitz rookies
When `isKnockingMode` is true but the rookie hasn't completed phase 4 or isn't unlocked, they fall through the knocking mode check and land on the regular rookie journey. This is correct behavior (pre-blitz rookies shouldn't see knocking mode), but with the new auto-toggle logic, a pre-blitz rookie who happens to plan a work day would see knocking mode activate but then fall through to their journey page anyway. **No action needed** -- the fall-through is the right UX since they're not ready for knocking mode yet.

### 2. Duplicate Zap icon in KnockingModeHome subtitle
Lines 182-183 render two `<Zap>` icons when `shouldStartSoon && knockingState === 'pre-work'`. One should be removed.

### 3. Massive code duplication across home variants
Home.tsx (1862 lines), VetHome.tsx (999 lines), PostBlitzRookieHome.tsx (1019 lines) all duplicate: logout logic, weather fetching, blitz RSVP, Airbnb action pills, pull-to-refresh, openInMaps/copyToClipboard utilities. This isn't a UX issue but creates maintenance risk.

### 4. KnockingModeHome card stack is solid but could be tighter
The current card ordering per knocking state is logical:
- **Pre-work**: Weather, Activity Summary, Daily Focus, Leaderboard, FP Chart
- **Working**: Daily Focus (hero), Activity, Leaderboard, FP Chart
- **Day-complete**: Daily Focus, Activity, FP Chart, Leaderboard

Cards like `PendingInstallAlertCard`, `RecapCTACard`, `MeVsMeMotivationCard`, `ActiveChallengesCard`, and `LeaderRookieReviewCard` show conditionally above the main stack. This is good -- they appear only when relevant.

### 5. VetHome non-knocking could feel more premium
VetHome is functional but card-heavy: VetAlertCard, LeaderRookieReviewCard, PendingInstallAlertCard, RecapCTA, MNL alert, ActiveChallenges, VetBlitzCard (for leaders), Recruiting Flow Carousel, VetBlitzCard (for non-leaders), 5-5-5 CTA. The 5-5-5 recruiting callout at the bottom feels generic.

---

## Recommended Changes

### Quick Wins (High impact, minimal risk)

**1. Fix duplicate Zap icon** in KnockingModeHome.tsx
Remove the duplicate `<Zap>` icon on line 183.

**2. Add `active:scale-[0.97]` press states to all home page cards**
Cards across KnockingModeHome, VetHome, and PostBlitzRookieHome lack the premium press feedback. Add `active:scale-[0.97] transition-transform` to tappable cards (LeaderboardCard, ActiveChallengesCard buttons, DailyFocusCard when navigable).

**3. Consistent spacing with `home-card-container` class**
KnockingModeHome uses `home-card-container` but PostBlitzRookieHome and VetHome have inconsistent card spacing (`space-y-4` vs `home-card-spacing` classes). Standardize to a single spacing system.

**4. PostBlitzRookieHome and VetHome header parity with KnockingModeHome**
KnockingModeHome has the cleanest header pattern: greeting + contextual subtitle + smart CTA (leaderboard callout or save alert). VetHome and PostBlitzRookieHome should adopt the same header structure for consistency:
- Remove redundant inline greeting calculations (replace with shared utility)
- Add the LeaderboardCTA to VetHome header (currently only in KnockingModeHome)

### Medium Effort (Polish and premium feel)

**5. Elevate the LeaderboardCard to a richer preview**
The current LeaderboardCard is a simple one-line button with a chevron. For the home page, show a slightly richer preview: user's current rank position or a mini podium (top 3 avatars) to make it more enticing.

**6. Active Challenges Card -- compact home variant**
ActiveChallengesCard (519 lines) is comprehensive with progress bars, avatars, and detail sheets. For the home page, show a compact "You're in 2 active competitions" summary pill rather than the full expanded view, linking to the Compete page for details.

**7. Consolidate shared header logic into a reusable component**
Create a `HomeHeader` component that handles: greeting, contextual subtitle, smart CTA (RSVP, leaderboard, save alert, blitz countdown), and Airbnb action pills. All three home variants would use this, eliminating hundreds of lines of duplication while ensuring a consistent premium header experience across all personas.

---

## Implementation Plan

### Phase 1: Quick fixes (this session)
1. Fix duplicate Zap icon in KnockingModeHome
2. Add press states to interactive cards
3. Standardize card spacing across home variants

### Phase 2: Header consolidation
4. Create shared `HomeHeader` component
5. Refactor VetHome, PostBlitzRookieHome, and KnockingModeHome headers

### Phase 3: Card polish
6. Enhance LeaderboardCard with richer preview
7. Add compact mode to ActiveChallengesCard for home page use

### Files to modify:
- `src/components/KnockingModeHome.tsx` -- fix Zap icon, press states
- `src/components/VetHome.tsx` -- header refactor, spacing, press states
- `src/components/PostBlitzRookieHome.tsx` -- header refactor, spacing
- `src/components/LeaderboardCard.tsx` -- richer preview
- `src/components/ActiveChallengesCard.tsx` -- compact mode prop
- New: `src/components/HomeHeader.tsx` -- shared header component
- `src/pages/Home.tsx` -- minor cleanup of inline header logic for pre-blitz rookies

### What stays the same:
- Card ordering in KnockingModeHome (already logical per state)
- Conditional card visibility (RecapCTA, MeVsMe, PendingInstall, etc.)
- All existing functionality and data flows
- Persona routing logic (already correct)
- The overall layout structure (header + card stack)

