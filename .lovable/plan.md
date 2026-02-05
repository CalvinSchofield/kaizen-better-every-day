
# Hybrid Access Control: Formal Titles + Recruiter Tree

## Problem Summary

You've identified a fundamental architectural tension that needs resolution:

### Current System Issues

1. **Adam can't see Ammon's recruits**: Adam is a `team_lead` which only grants access to people on his formal team. But Ammon (Adam's recruit) has his OWN team, so Ammon's 9 recruits (Jackson, Jayden, Jordan, etc.) are invisible to Adam.

2. **Calder recruited Ansel** but Calder isn't a team lead - he only gets `recruiter` access. However, there's also a bug in the recursive downline function that breaks at depth > 1.

3. **Title rigidity**: The system requires exact formal titles (Team Lead, MGMT Lead, Area Director) but org structure is often uncertain until later in the season.

### Root Causes

**Cause 1: Team Leads Don't Get Recruiter Downline**
```
Lines 474-491 in fetch-team-access/index.ts:

team_lead access ONLY includes:
  - Reps whose teamId matches the leader's formal team(s)
  
BUT MISSING:
  - The leader's entire recruiter downline (like "recruiter" access has)
```

**Cause 2: Bug in Recursive Downline Function**
```
Line 510: getDownlineRecruits(recruit.id, depth + 1)

Problem: Uses recruit.id (UUID from recruits table)
         But searches for recruiter_user_id (auth user UUID)
         These are DIFFERENT for people with accounts!
```

---

## Solution: Hybrid "Formal + Organic" Access Model

### Core Principle

> **Anyone with formal leadership OR anyone who has recruited someone gets access to their FULL recruiter downline, PLUS formal structure visibility.**

### Access Level Hierarchy

```text
┌─────────────────────────────────────────────────────────────┐
│ AREA DIRECTOR                                               │
│   → See ALL reps (current behavior - no change)             │
├─────────────────────────────────────────────────────────────┤
│ MGMT GROUP LEAD                                             │
│   → See all teams in their mgmt group(s)                    │
│   → PLUS their full recruiter downline                      │
├─────────────────────────────────────────────────────────────┤
│ TEAM LEAD                                                   │
│   → See their formal team(s)                                │
│   → PLUS their full recruiter downline  ← KEY ADDITION      │
├─────────────────────────────────────────────────────────────┤
│ RECRUITER (no formal title)                                 │
│   → See their full recruiter downline (current behavior)    │
└─────────────────────────────────────────────────────────────┘
```

### Example After Fix

**Adam Schofield (Team Lead):**
- Formal team: 8 reps (Abi, Brady, Clément, Daniel, Jack, Noah, Tyson, Brady H)
- Recruiter downline: 9 direct + 9 via Ammon = 18 total
- **Combined unique access**: All 18 people (deduplicated)

**Calder Severson (Recruiter):**  
- No formal team
- Recruiter downline: 2 direct (Ansel, Weston) + 11 via Ansel = 13 total

---

## Technical Changes

### File 1: `supabase/functions/fetch-team-access/index.ts`

#### Change 1: Fix the recursive downline bug (line 510)

The current code:
```typescript
const indirectRecruits = getDownlineRecruits(recruit.id, depth + 1);
```

Needs to use the recruit's `user_id` (from the reps table), not their recruit record ID:
```typescript
// Find the recruit's user_id from reps table to trace their downline
const recruitRep = repsData.find(r => r.id === recruit.id);
if (recruitRep?.user_id) {
  const indirectRecruits = getDownlineRecruits(recruitRep.user_id, depth + 1);
  result.push(...indirectRecruits);
}
```

#### Change 2: Refactor `getDownlineRecruits` to be reusable

Move the helper function OUTSIDE the access level if/else blocks so it can be used by BOTH `team_lead` and `recruiter` access levels.

#### Change 3: Update `team_lead` access to include recruiter downline

Current (lines 474-491):
```typescript
} else if (accessLevel === 'team_lead') {
  // Only formal team access
  const userTeams = teams.filter(t => t.groupLeadId === user.id);
  const userTeamIds = userTeams.map(t => t.id);
  
  for (const rep of repsData) {
    const teamInfo = getRepTeamInfo(rep);
    if (teamInfo.teamId && userTeamIds.includes(teamInfo.teamId)) {
      accessibleReps.push(buildRepData(rep));
    }
  }
}
```

After:
```typescript
} else if (accessLevel === 'team_lead') {
  const addedIds = new Set<string>();
  
  // 1) Formal team access (existing behavior)
  const userTeams = teams.filter(t => t.groupLeadId === user.id);
  const userTeamIds = userTeams.map(t => t.id);
  
  for (const rep of repsData) {
    if (rep.user_id === user.id || rep.id === currentUserRepId) continue;
    
    const teamInfo = getRepTeamInfo(rep);
    if (teamInfo.teamId && userTeamIds.includes(teamInfo.teamId)) {
      if (!addedIds.has(rep.id)) {
        addedIds.add(rep.id);
        if (rep.user_id) accessibleUserIds.push(rep.user_id);
        accessibleReps.push(buildRepData(rep));
      }
    }
  }
  
  // 2) PLUS: Recruiter downline (NEW!)
  const downlineRecruits = getDownlineRecruits(user.id, addedIds);
  for (const recruit of downlineRecruits) {
    // Skip self
    if (recruit.id === currentUserRepId) continue;
    
    const matchingRep = repsData.find(r => r.id === recruit.id);
    if (matchingRep) {
      if (matchingRep.user_id && !accessibleUserIds.includes(matchingRep.user_id)) {
        accessibleUserIds.push(matchingRep.user_id);
      }
      accessibleReps.push(buildRepData(matchingRep));
    } else {
      accessibleReps.push(buildRecruitAsRepData(recruit));
    }
  }
  
  console.log(`Team lead has formal team access + ${downlineRecruits.length} from recruiter tree`);
}
```

#### Change 4: Similarly update `mgmt_group_lead` to include recruiter downline

Same pattern - after getting formal MGMT group access, ALSO add recruiter downline.

---

## Data Flow After Changes

```text
Adam logs in → fetch-team-access
         │
         ├─► Determine access level: "team_lead"
         │
         ├─► Get formal team(s): ["Adam Schofield" team]
         │   └─► 8 reps on that team
         │
         ├─► Get recruiter downline:
         │   ├─► Direct: Ammon, Abi, Brady A, Brady H, Clément,
         │   │           Daniel, Jack, Noah, Tyson (9 people)
         │   │
         │   └─► Recursive (Ammon's recruits):
         │       Jackson, Jayden, Jordan, Levi, Luis,
         │       Luka, Trevor, Tyler, Wyatt (9 more)
         │
         └─► Deduplicate & return: 18 unique accessible reps
```

---

## Future Consideration: Title Management UI

Once this hybrid system is in place, you'll also want a simple way to:
1. Promote someone from Team Lead → MGMT Lead (and auto-assign teams under them)
2. See the org chart with both formal titles AND recruiter relationships
3. Bulk update team assignments when structure crystallizes

This could be a separate "Org Management" admin view, but that's Phase 2.

---

## Summary

| Change | Impact |
|--------|--------|
| Fix recursive bug | Calder can now see Ansel's 11 recruits |
| Add recruiter tree to team_lead | Adam can now see Ammon's 9 recruits |
| Add recruiter tree to mgmt_group_lead | MGMT leads see their full organic downline too |
| Deduplication | No double-counting when formal + organic overlap |

This creates the hybrid system you described: **formal titles for organizational clarity, recruiter tree for complete visibility**.
