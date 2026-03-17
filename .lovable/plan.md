

## Two New Notification Types + Notification Preferences Menu

### Part 1: New Notifications

**1a. "Direct Recruit Sold" notification**
When a rep logs a sale, we already call `notify-watchlist-sale`. We need a new edge function `notify-recruiter-sale` that:
- Takes `sellerUserId`, `prmr`, `fpPlus`, `customerName` from the sale
- Looks up the seller's recruit record to find `recruiter_user_id`
- Sends a push to the recruiter: "🎉 {RepName} just sold! $X PRMR"
- Deduplicates via `notification_logs` with type `recruit_sale`
- Fires from `TrackWithLayout.tsx` alongside the existing watchlist-sale call

**1b. "Rookie Transition" notification**
When a rookie logs a transition (counter increment), notify their recruiter:
- New edge function `notify-recruiter-transition`
- Takes `repUserId` — looks up recruiter via recruits table
- Sends: "🏠 {RookieName} just transitioned into a home!"
- Only fires for rookies (check `year = 'Rookie'` on the rep)
- Deduplicate per day per rep (one notification per transition per day max)
- Fire from `TrackWithLayout.tsx` when transition counter increments

### Part 2: Notification Preferences Table

**Database migration:**
```sql
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, notification_type)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can manage their own preferences
CREATE POLICY "Users can manage own notification preferences"
  ON public.notification_preferences FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

All edge functions that send notifications will check this table before sending. If a row exists with `enabled = false` for that `(recipient_user_id, notification_type)`, skip sending.

### Part 3: Notification Settings UI

Replace the current single "Save Reminders" toggle with a world-class notification settings page, designed like iOS Settings > Notifications. Structure:

**Layout:** Full-width card with grouped sections, each with an icon, title, description, and toggle.

**Sections:**
1. **Master Toggle** — "Push Notifications" on/off (existing subscribe/unsubscribe logic). When off, all individual toggles are disabled/greyed out.

2. **My Activity** (grouped)
   - Save Reminders — "Reminded to save your work after sunset" ⏰
   - Start Your Day — "Noon nudge if you haven't started" ☀️
   - Personal Records — "When you break a PR" 🏆
   - Task Reminders — "Morning digest, past due, evening nudge" 📋

3. **My Recruits** (grouped)
   - Recruit Sale — "When a direct recruit closes a deal" 🎉
   - Rookie Transition — "When a rookie transitions into a home" 🏠
   - Onboarding Updates — "When recruits complete onboarding steps" ✅
   - Access Requests — "When someone requests app access" 👋

4. **Social** (grouped)
   - Comments & Mentions — "When someone comments or @mentions you" 💬
   - Reactions — "When someone reacts to your activity" 🔥
   - Watchlist Sales — "When someone you're watching sells" 👀

5. **Competitions** (grouped)
   - Challenge Updates — "Invites, progress, results" ⚔️
   - Incentive Updates — "New incentives and completions" 🎯

6. **Leadership** (grouped, only visible for leaders)
   - Coaching Nudges — "When a rep needs attention" 📊
   - Blitz RSVPs — "Blitz attendance reminders" 🗓️

**Design approach:**
- Each section has a subtle header label (like iOS section headers)
- Each row: icon + title + subtitle on left, Switch on right
- Smooth animations on section expand/collapse
- All toggles default to ON (opt-out model)
- When master toggle is off, all rows show as muted/disabled
- Uses the existing `notification_preferences` table — absence of a row = enabled (default on)

### Files to Create/Edit

- **New:** `supabase/functions/notify-recruiter-sale/index.ts`
- **New:** `supabase/functions/notify-recruiter-transition/index.ts`
- **New:** `src/components/NotificationSettings.tsx` — the beautiful settings UI
- **New:** `src/hooks/useNotificationPreferences.ts` — CRUD hook for preferences
- **Edit:** `src/components/TrackWithLayout.tsx` — fire new notification calls on sale/transition
- **Edit:** `src/pages/Settings.tsx` — replace current notification section with `<NotificationSettings />`
- **Edit:** All existing notification edge functions — add preference check before sending
- **DB migration:** Create `notification_preferences` table

