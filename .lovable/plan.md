

# Redesign Drawer Grouping and Visual Hierarchy

## New Semantic Groups

Current groups don't match what items actually do. Here's the corrected mental model:

```text
PERFORMANCE          — Your numbers, your activity
  Track              — Log daily knocking activity
  Calendar           — View daily sales history  
  Insights           — Performance analytics

GROWTH               — Getting better
  Training           — Learning resources
  Goals              — Set your targets

TEAM                 — Social / competitive
  Leaderboard        — Rankings
  Compete            — Head-to-head challenges
  Reports            — Team performance (leaders)
  My Group           — Recruiting

CLIENTS              — Your sales relationships
  Customers          — Logged sales & contacts
```

Account section stays at the bottom (Settings, Refresh Data, Logout pinned).

## Visual Redesign

Instead of flat list + tiny uppercase labels + no visual separation, each group becomes a **rounded card container** with:
- Subtle `bg-muted/30` background with `rounded-xl`