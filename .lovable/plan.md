

## Problem Analysis

There are two related issues:

1. **All tasks shown as "yours"**: The `WeekPlannerSection` displays ALL `recruit_activities` with a `next_action_due` across the entire downline, regardless of who created or is assigned the task. When Misael creates a task for EJ assigned to himself, you still see it in your Overdue list as if you need to do it.

2. **Too much noise for leaders with large orgs**: As an Area Director, you see every recruit and every task across the entire organization by default. As the org grows, this becomes unmanageable. The default view should surface what's most actionable for YOU.

## Solution: Smart Task Ownership Filtering + Collapsible "My Org" Section

### Core Logic Change

Filter `scheduledTasks` in `WeekPlannerSection` to only show tasks that are **owned by the current user**:
- Tasks where `logged_by_user_id === currentUserId` AND `assigned_to_user_id` is null (self-assigned)
- Tasks where `assigned_to_user_id === currentUserId` (explicitly assigned to you)
- Exclude tasks logged by others and assigned to others (like Misael's EJ task)

### UI Structure for Leaders

**Default view (collapsed):**
- **"My Tasks"** — Only tasks you created for yourself or assigned to you. This is the Overdue / Today / Rest of Week planner that exists today, but filtered to YOUR tasks only.
- **"Recommended for You"** — The existing AI recommendations, but capped at 3-4 and focused on YOUR direct recruits first, then downline.

**Expandable section:**
- **"Team Activity" (collapsed by default)** — An expandable section showing tasks across the org, grouped by team/person. Leaders can tap to expand and see what their team is working on, but it doesn't clutter the default view.

### Files to Change

1. **`src/components/mygroup/WeekPlannerSection.tsx`**
   - Pass `currentUserId` into the component (from parent or via `useCurrentUserId`)
   - Filter `scheduledTasks` to only include tasks owned by the current user
   - Add a collapsible "Team Tasks" section at the bottom showing the remaining org-wide tasks (collapsed by default)
   - Show a count badge on the collapsed section so leaders know there's activity

2. **`src/pages/MyGroup.tsx`**
   - Pass `currentUserId` to `WeekPlannerSection`

3. **`src/components/mygroup/TodaysFocusHero.tsx`**
   - Apply the same ownership filter to the hero card's overdue/today item selection, so the hero only surfaces YOUR tasks

4. **`src/hooks/useRecruitingRecommendations.ts`** (minor)
   - Optionally prioritize direct recruits (where `recruiterUserId === currentUserId`) over deep downline in recommendation scoring

### How Ownership Is Determined

```text
Activity has next_action_due?
  ├─ assigned_to_user_id === me → SHOW in "My Tasks"
  ├─ assigned_to_user_id === someone else → HIDE from "My Tasks" (show in "Team Tasks")
  └─ assigned_to_user_id is null
       ├─ logged_by_user_id === me → SHOW in "My Tasks"
       └─ logged_by_user_id !== me → HIDE from "My Tasks" (show in "Team Tasks")
```

### Team Tasks Collapsed Section

A simple collapsible card at the bottom:
- Header: "Team Activity · 8 tasks" with a chevron
- Collapsed by default
- When expanded, shows the same swipeable task cards grouped by team member name
- This preserves full visibility without creating noise

