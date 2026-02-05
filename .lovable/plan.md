
# Plan: Bulk Entry Detection & Warning in Activity Flow

## Overview
Add intelligent detection of "bulk entry" patterns (when reps tap counters rapidly in batches rather than throughout the day) and surface this as a visible warning in the Activity Flow visualization. This will help leaders immediately identify reps who have this habit without needing to query the database.

## The Problem
Currently, when a rep like Izaiah Martinez logs 38 doors in 9 seconds at 5:35 PM, the Activity Flow timeline simply shows a compressed cluster of events. There's no indication that this is abnormal or batch-logged behavior. Leaders have no way to distinguish real-time logging from after-the-fact bulk entry without manually querying the database.

## Technical Design

### 1. Bulk Entry Detection Algorithm
Add a new `useMemo` calculation in `RepDayActivityFlow.tsx` that detects bulk entry patterns:

```text
Detection Criteria:
┌─────────────────────────────────────────────────────┐
│  A "batch" is detected when:                        │
│  • 5+ events of the same type                       │
│  • All logged within 30 seconds                     │
│  • This results in an average tap rate > 0.5/sec   │
│                                                     │
│  A day has "bulk entry habits" when:               │
│  • Total batched events > 50% of all events        │
│  • OR largest single batch > 20 events             │
└─────────────────────────────────────────────────────┘
```

### 2. New Stats Added to Activity Flow Summary
Add new fields to the existing `stats` object:
- `bulkEntryDetected`: boolean
- `largestBatch`: number (e.g., 38)
- `batchedEventsCount`: number
- `batchedEventsPercent`: number
- `batches`: array of batch details (for popover)

### 3. UI Changes

#### A. Warning Badge in Summary Row
Add a new warning indicator to the "Smart Summary" row at the bottom of the Activity Flow:

```text
Before:
⏱️ 4m selling | 🏠 1 home | 💬 1 convo

After (when bulk entry detected):
⚡ 38 bulk-logged | ⏱️ 4m selling | 🏠 1 home | 💬 1 convo
```

The ⚡ icon with orange/amber styling will be immediately visible and tappable.

#### B. Popover with Batch Details
When tapped, show a popover with:
- "Bulk Entry Detected" header
- List of batches: "38 doors at 5:35 PM (in 9 sec)"
- Percentage of activity that was bulk-logged
- Coaching tip: "Real-time logging provides more accurate insights"

#### C. Visual Timeline Indicators
Add subtle visual markers on the timeline where bulk batches occurred:
- A small ⚡ icon above the timeline at batch locations
- Orange/amber highlight on the track segment where batches occurred

### 4. Files to Modify

| File | Changes |
|------|---------|
| `src/components/reports/v2/RepDayActivityFlow.tsx` | Add bulk detection logic, new stats, warning UI |

### 5. Implementation Steps

1. **Add batch detection logic** (new `useMemo`)
   - Group events by type
   - For each type, identify rapid sequences (< 30 sec apart)
   - Calculate batch statistics

2. **Extend stats object**
   - Add `bulkEntryDetected`, `largestBatch`, `batchedEventsCount`, `batches` array

3. **Add warning badge to summary row**
   - New conditionally-rendered span with Popover
   - Orange/amber styling to draw attention
   - ⚡ Zap icon from lucide-react

4. **Add timeline visual indicators** (optional enhancement)
   - Small markers above timeline at batch positions
   - Subtle but noticeable

### 6. Example Detection

For Izaiah's Feb 4th data:
```text
Batches detected:
• 11 doors at 1:05 PM (in 6 sec) → 1.8 doors/sec
• 38 doors at 5:35 PM (in 9 sec) → 4.2 doors/sec  ← Largest
• 18 doors at 8:15 PM (in 6 sec) → 3.0 doors/sec

Result:
- largestBatch: 38
- batchedEventsCount: 67 (out of 77 total doors)
- batchedEventsPercent: 87%
- bulkEntryDetected: true
```

### 7. User Experience

**For Leaders viewing Activity Flow:**
- Immediately see ⚡ warning in the summary row
- Tap to see exactly when/how much was bulk-logged
- Can use this for coaching conversations

**Visual mockup of the new summary row:**
```text
┌────────────────────────────────────────────────────────┐
│  ⚡ 38 bulk  | ⏱️ 4m selling | 🏠 1 home | ⚠️ 1 gap   │
│     ↑                                                  │
│  Orange badge, tappable for batch details              │
└────────────────────────────────────────────────────────┘
```

---

## Summary
This feature adds automatic detection of bulk-logged data with clear visual indicators in the Activity Flow, allowing leaders to immediately identify when a rep's timeline may not accurately reflect their actual work pattern.
