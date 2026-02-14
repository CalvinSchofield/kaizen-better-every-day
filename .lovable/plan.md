

# Home Page Polish and Persona-Aware UX Audit

## ✅ Completed Changes

### Phase 1: Quick Fixes
1. **Fixed duplicate Zap icon** in KnockingModeHome.tsx (removed second `<Zap>` on line 183)
2. **Added `active:scale-[0.97]` press state** to LeaderboardCard for premium native feel
3. **Card spacing verified** — all three home variants (KnockingModeHome, VetHome, PostBlitzRookieHome) already use `home-card-container` class consistently

### Phase 1.5: Header Parity
4. **Added LeaderboardCTA to VetHome and PostBlitzRookieHome headers** — now all three home variants show the competitive leaderboard callout in the header when no RSVP is active
5. **Removed manual refresh button from PostBlitzRookieHome** — matches KnockingModeHome's clean pattern (data freshness handled by staleTime + pull-to-refresh)

### Phase 2: Card Polish
6. **Enhanced LeaderboardCard** — added:
   - Circular icon container with emoji trophy for visual weight
   - Richer subtitle: shows "You're leading [metric] [timeframe]!" with Crown icon when user leads, or "Leader name · value timeframe" with TrendingUp icon otherwise
   - Proper text truncation for long names
   - `active:scale-[0.97]` press feedback

## Remaining Opportunities (Future Sessions)

### Medium Effort
- **Shared HomeHeader component**: The RSVP and blitz CTA logic is deeply entangled with per-component state (weather sheets, blitz data). Full extraction would require significant refactoring. The header is now visually consistent across all variants.
- **ActiveChallengesCard compact mode**: Show a summary pill on home page instead of full expanded view
- **VetHome 5-5-5 card**: Could be made more actionable or replaced with a smarter CTA

### Low Priority
- **Code deduplication**: VetHome (1004 lines) and PostBlitzRookieHome (1008 lines) share ~300 lines of identical RSVP, weather, and utility logic. Extracting into shared hooks would reduce maintenance risk but doesn't affect UX.
