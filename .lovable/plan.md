

## Profile Page Enhancement: Contact Actions, Goal Pace, and Activity Log

### Overview

When viewing another rep's profile (not just leaders -- anyone in the office), surface three new contextual features below the Momentum Sparkline and above the existing Tabs section. The design stays minimal: a compact action bar and one swipeable card that doesn't clutter the page.

### Feature 1: Quick Contact Bar (Call / Text)

**Who sees it**: Anyone viewing a profile that is NOT their own.

**What it does**:
- Two pill buttons: "Call" and "Text" (same style as the stats bar card, not full-width buttons)
- Tapping "Call" opens `tel:{phone}` and then shows the PostContactDrawer to log notes
- Tapping "Text" opens `sms:{phone}` and then shows the PostContactDrawer to log notes
- If no phone number is on file, prompts for phone entry first (reusing the existing phone-entry pattern from RecruitDetailDrawer)

**Data needed**: Add `phone` to the `useRepProfile` hook's reps query. Also need to resolve the viewed user to a `Recruit` object (or a minimal stub) so PostContactDrawer can receive it.

**Location on page**: Rendered as a slim card (`mx-5 mb-4 rounded-2xl bg-card border`) right after the stats bar, before the Momentum Sparkline. Two side-by-side outline buttons.

### Feature 2: Goal Pace Card (Swipeable with Momentum)

**Who sees it**: Leaders viewing a downline rep's profile (checked via `useTeamAccess().accessibleUserIds.includes(userId)`)

**What it does**:
- The Momentum Sparkline card becomes the first "page" in a horizontally swipeable container
- Swiping left reveals a "Goal Pace" card that mirrors the FocusCard's pace section:
  - Progress bar showing `ytdFP / goal` with percentage
  - Pace status badge (Ahead / On Track / Behind / At Risk)
  - "Avg X.XX/day | Need X.XX/day" comparison line
  - Goal tier label (Preseason / Must Do / Will Do / Could Do)
- Dot indicators at the bottom show which card is active (like iOS page dots)

**Data needed**: Create a new hook `useDownlineGoalPace(userId)` that:
1. Fetches `rep_goals` for the target user
2. Fetches `season_config` for personal summer dates
3. Calls `fetch-downline-planned-days` edge function for planned days count
4. Fetches finalized daily entries count for knocking days
5. Uses the existing `calculateSalesPace` utility for pace computation
6. Returns: goal, ytdFP, paceStatus, neededDaily, currentAvgDaily, daysWorked, progressPercent, goalLabel

**Location on page**: Replaces the standalone MomentumSparkline. Both cards sit in an `embla-carousel-react` horizontal scroller with snap points.

### Feature 3: Recent Activity Timeline (Compact)

**Who sees it**: Leaders viewing a downline rep's profile

**What it does**:
- A small "Recent Activity" section showing the last 3 logged interactions (from `recruit_activities` table)
- Each row: icon (phone/text/note), relative time ("2d ago"), truncated notes
- A "View All in My Group" link at the bottom that navigates to the RecruitDetailDrawer's activity tab

**Data needed**: Query `recruit_activities` for the recruit record matching the viewed user (match by email or name, same pattern as RecruitDetailDrawer's `recruitRepData` lookup). Limit 3, order by `created_at desc`.

**Location on page**: Rendered as a card below the Momentum/GoalPace swiper, above the Tabs section. Only appears for leaders with the viewed user in their downline.

### Technical Implementation

#### Files to modify:

**`src/hooks/useRepProfile.ts`**
- Add `phone` to the reps select query
- Return `phone` in the RepProfileData interface

**`src/hooks/useDownlineGoalPace.ts`** (new file)
- Accepts `userId: string | null`
- Fetches goals, summer config, planned days, knocking days
- Runs `calculateSalesPace` and returns structured pace data
- Only enabled when userId is provided

**`src/components/profile/ProfileContactBar.tsx`** (new file)
- Slim card with Call/Text buttons
- Manages phone entry drawer state internally
- Opens PostContactDrawer after initiating call/text
- Needs: phone, name, userId of viewed profile + a minimal Recruit-shaped stub for PostContactDrawer

**`src/components/profile/GoalPaceCard.tsx`** (new file)
- Displays progress bar, pace badge, daily average comparison
- Receives data from `useDownlineGoalPace`
- Matches the card styling of MomentumSparkline (same border radius, padding, bg-card)

**`src/components/profile/ProfileSwiper.tsx`** (new file)
- Wraps MomentumSparkline + GoalPaceCard in an embla-carousel with dot indicators
- Falls back to just MomentumSparkline when GoalPaceCard data isn't available

**`src/components/profile/RecentActivityCard.tsx`** (new file)
- Compact 3-row activity list
- Link to open RecruitDetailDrawer or navigate to My Group

**`src/pages/Profile.tsx`**
- Import `useTeamAccess` to check if viewer is a leader with this user in downline
- Import `useDownlineGoalPace` for pace data
- Replace standalone `<MomentumSparkline>` with `<ProfileSwiper>` (passes GoalPaceCard when leader is viewing downline)
- Add `<ProfileContactBar>` for non-own profiles (below stats bar, before swiper)
- Add `<RecentActivityCard>` for leaders viewing downline (after swiper, before tabs)
- Add PostContactDrawer + phone entry Drawer at bottom of component tree

#### Visual Layout (top to bottom):

```text
[Hero Photo with Name]
[Stats Bar: YTD FP+ | YTD PRMR | Coming Soon]
[Contact Bar: Call | Text]              <-- new, non-own profiles only
[Swipeable: Momentum | Goal Pace]      <-- Goal Pace for leaders only
[Recent Activity: 3 rows + link]        <-- leaders viewing downline only
[Tabs: Stats | Records | Badges]
```

#### PostContactDrawer Integration

The PostContactDrawer requires a `Recruit` object. Since we're on the profile page (not My Group), we'll construct a minimal Recruit stub from the profile data:

```typescript
const recruitStub: Recruit = {
  id: repId, // from reps table
  name: profile.name,
  phone: profile.phone,
  stage: 'Sold', // default for viewing context
  // ... other required fields with safe defaults
};
```

This allows the same note-logging and follow-up scheduling flow without requiring the full My Group context.

