

# Summer Nav Audit: Knocking vs Recruiting Duality

## The Core Insight

You're right — this job is binary: **knocking** (selling) or **recruiting** (building your team). Every feature should orbit one of those two poles. The toggle is the mode switch between them.

## Current State (Leaders)

| | Knocking ON | Knocking OFF |
|---|---|---|
| **FAB** | Track | My Group |
| **Nav** | Leaderboard · Tools · Reports · Compete | **Blitzes** · Tools · Calendar · Goals |

**Knocking ON** is solid — Track is the hub, Leaderboard/Compete are motivation, Reports is coaching, Tools is field support.

**Knocking OFF** breaks once summer starts — Blitzes is dead weight. And Calendar/Goals are more knocking-adjacent than recruiting-adjacent.

## Proposed Change

When knocking mode is OFF **and the user's personal summer has started**, replace the Blitzes slot with **Reports** for leaders. This gives leaders their coaching dashboard front-and-center when they're in recruiting/team-building mode.

**Summer leader nav (knocking OFF):** Reports · Tools · Calendar · Goals (FAB: My Group)

This means the two modes for a summer leader become:
- **Knocking ON:** Track (FAB) · Leaderboard · Tools · Reports · Compete → *"Go sell"*
- **Knocking OFF:** My Group (FAB) · Reports · Tools · Calendar · Goals → *"Go build your team"*

Reports appears in both because leaders always need team visibility — but the surrounding context shifts from competition/field to coaching/planning.

## Does It Hold Up to the Duality Test?

**Knocking mode** (selling): Track → log production. Leaderboard/Compete → stay motivated. Tools → field resources. Reports → see how team is doing on doors.

**Recruiting mode** (building): My Group → manage pipeline. Reports → coach reps. Training → available in drawer. Goals → plan targets. Calendar → review schedule.

The drawer stays the same — Insights, Training, Customers, Compete are all accessible from there. The nav bar surfaces what matters *right now* for whichever mode you're in.

## Implementation

**File:** `src/components/Layout.tsx` (~line 217-224)

In the knocking-OFF leader branch, check if the user's `personal_summer_start` has passed. If so, show Reports instead of Blitzes.

Requires reading `repData.personal_summer_start` (already available via `useRepData`) and comparing against today's date. One conditional change in `getNavItems()`.

**File:** `src/components/AppDrawer.tsx` — no changes needed, drawer already has Reports for leaders.

