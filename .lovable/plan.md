
# Demo Data Setup Plan: Fake Sales + Competitions

## Overview

You're demoing the app today and need realistic fake data for:
1. **Sales/activity data** for target reps (Rookies with Sold/Sold 5+ stages + all Sophomores/Vets except you)
2. **Team Battle**: Red vs Blue, all reps, public, stakes = BBQ dinner
3. **1v1 Challenge**: Ammon Allan vs Quinn Gleed on PRMR, public
4. **Incentive**: "Anyone who" - Rookies with 2+ FP+ get energy drinks

**Critical requirement**: All data must be easily deletable after the demo.

---

## Target Reps for Demo Data

Based on database query, **23 reps** will receive fake daily_entries:

### Rookies (Sold/Sold 5+) - 8 reps:
| Name | User ID |
|------|---------|
| Bryson Bradshaw | c8055f1f-1871-4995-82ae-8f44289b356d |
| Izaiah Martinez | a79bcce8-0bd7-4812-9a2c-1ac96cf2fcd5 |
| Jackson Jennings | 3ab2ef67-df50-436d-a7b9-8e179b84307f |
| Jay Tingey | 8ea77d54-223e-490d-b720-5a5c18667315 |
| JP (Jason) Perales | 5076efe0-a115-440f-92fa-93f4f819519d |
| Noah Delgado | 8efaac75-4e91-4989-9ce5-6da02ce462b5 |
| Trevor Allan | 67c22aa0-2cdd-4636-a15d-1425910ed042 |
| Weston | d37d3df9-5657-4a7d-8ac3-742ab07f3fac |

### Sophomores - 10 reps:
| Name | User ID |
|------|---------|
| Abi Cunningham | dde01bfc-6f28-4ef3-914f-dd2602b61e7e |
| Ammon Allan | 4180229c-27e4-4a0a-9f45-b3a399950dd6 |
| Ansel Severson | a848bd1a-886c-4ea6-b093-060117a89dd3 |
| Austin Clayton | b38b47e4-af04-4c4f-9c0c-d7b2f81964fa |
| Christian Fabian | 393c450a-2241-4d03-91a7-f046d8019ec1 |
| Ephraim Wilde | 68f129d0-fd1b-4154-8ab5-74bdc7ef6388 |
| Jack Mair | bcf3761d-9d3c-4d59-9175-7232a4084187 |
| Javier Estrada | 1123659a-5e6c-4a07-bf2d-3ada4237b5da |
| Jose Pineda | a9f5a317-e9cd-433a-bd93-e7c413ba5cc6 |
| RJ Ashton | ae5e1425-6b6b-4f6b-9ef4-af8289e84efa |

### Vets (excluding you) - 4 reps:
| Name | User ID |
|------|---------|
| Adam Schofield | 1712a7f8-0b37-4095-916c-67e03ce169df |
| Calder Severson | fc0a08d5-14bb-4690-96d6-2e48d0645de9 |
| Misael Sanchez | 373d13e3-24ea-49b8-8327-13cedae789d0 |
| Quinn Gleed | 69c2fc5c-f6c0-4926-9d73-e5db117cd5ce |

---

## Fake Data Specifications

### Daily Entry Metrics (Realistic Ratios)

Each rep gets data with randomized but realistic metrics:

| Metric | Range | Rules |
|--------|-------|-------|
| **doors_knocked** | 35-85 | Highest ~85 |
| **decision_makers** | 8-25 | Can exceed pitches for some |
| **pitches** | 6-20 | Generally ≤ decision_makers |
| **transitions** | 4-12 | Can exceed presentations |
| **presentations** | 2-8 | Never > closes+2 |
| **closes** | 0-4 | Never > presentations |
| **FP+** | 0-3.4 | Max 3.4, best ratio ~42 doors → 3 FP+ |
| **PRMR** | $0-$350 per FP | Realistic per-close amounts |

### Work Session Timestamps

- **work_start_time**: 9:00 AM - 10:15 AM (local time)
- **work_end_time**: 7:00 PM - 8:30 PM (local time)
- **Presentation length**: 20 min - 2 hours (reflected in counter_timestamps)
- **Timezone**: America/Denver (Utah-based team)

### Sales Log Structure

Each FP generates a sale in `sales_log`:
```json
{
  "id": "demo-sale-{uuid}",
  "type": "fp",
  "prmr": 75-120,
  "timestamp": "2026-01-31T14:32:00-07:00",
  "install_status": "installed",
  "installed_same_day": true
}
```

---

## Competition Data

### 1. Team Battle: Red vs Blue

| Field | Value |
|-------|-------|
| **Type** | group |
| **Metric** | fp_plus |
| **Status** | active |
| **Visibility** | public |
| **Stakes** | "BBQ dinner on Sunday - losing team cooks for winners!" |
| **Start Date** | 2026-01-31 |
| **End Date** | 2026-01-31 |
| **Created By** | You (843dac61-139d-4511-a057-c3bf359a9c07) |

**Team Assignments (balanced by experience):**

| Team Red (A) | Team Blue (B) |
|--------------|---------------|
| Bryson Bradshaw | Izaiah Martinez |
| Jackson Jennings | Jay Tingey |
| JP Perales | Noah Delgado |
| Trevor Allan | Weston |
| Ammon Allan (Captain) | Quinn Gleed (Captain) |
| Ansel Severson | Christian Fabian |
| Austin Clayton | Jack Mair |
| Javier Estrada | Jose Pineda |
| Adam Schofield | Calder Severson |
| RJ Ashton | Misael Sanchez |
| Abi Cunningham | Ephraim Wilde |

### 2. 1v1 Challenge: Ammon vs Quinn

| Field | Value |
|-------|-------|
| **Type** | 1v1 |
| **Metric** | prmr |
| **Status** | active |
| **Visibility** | public |
| **Stakes** | "Loser buys winner lunch next week" |
| **Start Date** | 2026-01-31 |
| **End Date** | 2026-01-31 |
| **Created By** | Ammon Allan (4180229c-27e4-4a0a-9f45-b3a399950dd6) |

### 3. Incentive: Rookie Energy Drinks

| Field | Value |
|-------|-------|
| **Title** | "2 FP+ Club" |
| **Reward** | "Energy drink from the drink fridge on Monday" |
| **Metric** | fp_plus |
| **Target Type** | anyone_who |
| **Target Value** | 2 |
| **Visibility** | public |
| **Status** | active |
| **Start Date** | 2026-01-31 |
| **End Date** | 2026-01-31 |
| **Eligible Reps** | All 8 Rookies (Sold/Sold 5+ only) |
| **Created By** | You (843dac61-139d-4511-a057-c3bf359a9c07) |

---

## Cleanup Strategy: Easy Deletion

All demo data will be tagged for easy cleanup:

### 1. Daily Entries
- Use today's date (2026-01-31) as the entry_date
- Add `notes: "DEMO_DATA"` field to all demo entries
- **Cleanup query:**
```sql
DELETE FROM daily_entries 
WHERE entry_date = '2026-01-31' 
  AND notes = 'DEMO_DATA';
```

### 2. Challenges
- Add `stakes` field containing "DEMO:" prefix OR use a specific created_at window
- **Cleanup query:**
```sql
-- Delete participants first (foreign key)
DELETE FROM challenge_participants 
WHERE challenge_id IN (
  SELECT id FROM challenges 
  WHERE created_at >= '2026-01-31' 
    AND created_at < '2026-02-01'
);

DELETE FROM challenges 
WHERE created_at >= '2026-01-31' 
  AND created_at < '2026-02-01';
```

### 3. Incentives
- Created today, easy to identify
- **Cleanup query:**
```sql
-- Delete eligible reps first
DELETE FROM incentive_eligible_reps 
WHERE incentive_id IN (
  SELECT id FROM incentives 
  WHERE created_at >= '2026-01-31' 
    AND created_at < '2026-02-01'
);

DELETE FROM incentives 
WHERE created_at >= '2026-01-31' 
  AND created_at < '2026-02-01';
```

### One-Click Cleanup Edge Function

I'll create a simple edge function `cleanup-demo-data` that you can call after the demo to delete everything in one action.

---

## Implementation Steps

### Phase 1: Create Edge Function for Demo Data
Create `supabase/functions/seed-demo-data/index.ts` that:
1. Inserts 22 fake `daily_entries` with realistic metrics and sales_log
2. Creates the team battle challenge with all participants
3. Creates the 1v1 Ammon vs Quinn challenge
4. Creates the Rookie incentive with all 8 rookies eligible

### Phase 2: Create Cleanup Edge Function
Create `supabase/functions/cleanup-demo-data/index.ts` that:
1. Deletes all demo daily_entries (where notes = 'DEMO_DATA')
2. Deletes demo challenges and their participants
3. Deletes demo incentives and their eligible reps
4. Returns a summary of what was deleted

### Phase 3: Invoke Functions
- Call `seed-demo-data` before your demo
- Call `cleanup-demo-data` after your demo

---

## Sample Fake Data Distribution

To ensure the demo looks realistic and interesting:

| Rep | Doors | FP+ | PRMR | Notes |
|-----|-------|-----|------|-------|
| Ammon Allan | 72 | 3.4 | $310 | **Top performer** - best ratio |
| Quinn Gleed | 68 | 2.8 | $285 | Strong competitor |
| Jackson Jennings | 85 | 2.2 | $195 | Most doors |
| Bryson Bradshaw | 42 | 2.1 | $180 | Efficient closer |
| Noah Delgado | 55 | 2.0 | $175 | Eligible for incentive |
| Trevor Allan | 48 | 1.8 | $155 | Eligible for incentive |
| Weston | 62 | 1.5 | $130 | Just missed incentive |
| Jay Tingey | 38 | 1.2 | $105 | |
| *Others* | 35-65 | 0-1.5 | $0-$125 | Varied performance |

This ensures:
- Ammon beats Quinn in PRMR (for the 1v1)
- 4-5 rookies hit the 2 FP+ incentive threshold
- Team Red slightly ahead (for tension)
- Nobody has unrealistic stats

---

## Technical Notes

- All entries will be marked `is_finalized: true` so they appear on leaderboards
- Sales log timestamps will be spread throughout the work day
- Counter timestamps will show realistic activity patterns
- Timezone set to `America/Denver` for all reps
