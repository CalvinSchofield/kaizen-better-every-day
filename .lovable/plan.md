

# Plan: Rep-Facing Bulk Entry Prevention UX

## The Problem
When reps log activity in rapid bursts (e.g., 38 doors in 9 seconds), the Activity Flow becomes meaningless for leaders. **Currently, there's nothing preventing or discouraging this behavior at the source.** The counter card accepts rapid taps indefinitely without any friction or feedback.

## Design Philosophy
Rather than hard-blocking rapid entry (which could frustrate reps), we'll use **progressive friction** - subtle UX nudges that become increasingly clear as the behavior continues. This educates reps on why real-time logging matters while still allowing flexibility.

---

## Proposed Interventions

### 1. Rapid Tap Cooldown with Visual Feedback
**Trigger:** 5+ taps on the same counter within 3 seconds

**Behavior:**
- After the 5th rapid tap, the counter card shows a brief "slowdown" animation
- A subtle pulse effect and temporary opacity reduction (0.7)
- Haptic feedback changes from `hapticMedium` to `hapticLight` (softer)
- Small toast appears: "Tapping in real-time gives you better insights!"

**Why it works:** Creates a subtle "friction bump" that makes the rep pause and think without blocking them.

```text
┌─────────────────────────────────────────────────────┐
│  Normal Tap → hapticMedium, scale-105, full opacity │
│                                                     │
│  Rapid Tap (5+) → hapticLight, no scale, opacity-70 │
│                + subtle amber border pulse           │
└─────────────────────────────────────────────────────┘
```

---

### 2. Bulk Entry Warning Banner
**Trigger:** 10+ taps within 30 seconds on any counter

**Behavior:**
- A dismissible banner slides in above the counter grid
- Shows: "⚡ Looks like you're catching up. Real-time logging helps you and your leaders see the full picture!"
- Includes a "Got it" button to dismiss
- Only shows once per session (persisted in sessionStorage)

**Why it works:** Provides educational context without being annoying on repeat.

---

### 3. "Start Your Day" Prompt Before First Tap
**Trigger:** First counter tap when `work_start_time` is null

**Behavior:**
- Instead of immediately logging the tap, show a quick bottom sheet:
  - "Ready to start tracking?"
  - Big "Start My Day" button → sets `work_start_time` to now, then logs the tap
  - Small "Just catching up" link → lets them tap without starting (flags entry)

**Why it works:** Creates a conscious moment of "I'm starting work now" vs. "I'm entering old data." If they choose "Just catching up," we can:
- Add a `backfill_mode: true` flag to the entry
- This feeds into the leader-facing bulk detection

---

### 4. Timestamp Context Chip on Counter Cards
**Trigger:** Always shown during active work session

**Behavior:**
- Each counter card shows a small timestamp chip of the last tap on that counter
- Example: "Last: 2:45 PM" in muted text below the counter value
- If the tap was > 30 minutes ago, shows in amber: "Last: 1:12 PM ⚠️"

**Why it works:** Makes the rep constantly aware of their logging cadence. Seeing "Last: 1:12 PM" when it's now 4:30 PM creates natural self-awareness.

```text
┌─────────────────────────┐
│         77              │
│    Doors Knocked        │
│   Last: 2:45 PM         │  ← Muted gray
└─────────────────────────┘

vs.

┌─────────────────────────┐
│         77              │
│    Doors Knocked        │
│   Last: 1:12 PM ⚠️      │  ← Amber warning
└─────────────────────────┘
```

---

### 5. Daily Recap Nudge (Optional Enhancement)
**Trigger:** When rep opens Track page and has an unfinalized entry from yesterday

**Behavior:**
- Shows the `SaveDayAlertCard` component (already exists)
- Add new variant: "Your yesterday entry was mostly logged after 6 PM. Try logging as you go today for better insights!"

**Why it works:** Connects the behavior to its consequence in a non-punitive way.

---

## Implementation Priority

| Priority | Feature | Impact | Effort |
|----------|---------|--------|--------|
| **P0** | Timestamp Context Chip | High - passive awareness | Low |
| **P1** | Rapid Tap Cooldown | Medium - immediate friction | Medium |
| **P2** | Bulk Entry Warning Banner | Medium - educational | Low |
| **P3** | Start Your Day Prompt | High - behavior change | Medium |
| **P4** | Daily Recap Nudge | Low - retrospective | Low |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/QTallyGrid.tsx` | Add rapid tap detection, cooldown state, timestamp chips |
| `src/pages/Track.tsx` | Add bulk entry warning banner, pass timestamps to grid |
| `src/components/ui/BulkEntryWarning.tsx` | **New file** - Warning banner component |

---

## Technical Details

### Rapid Tap Detection Logic (in CounterCard)

```typescript
// Track recent taps
const recentTapsRef = useRef<number[]>([]);

const handleTap = () => {
  const now = Date.now();
  recentTapsRef.current = recentTapsRef.current
    .filter(t => now - t < 3000); // Keep only taps from last 3 seconds
  recentTapsRef.current.push(now);
  
  const isRapidTapping = recentTapsRef.current.length >= 5;
  
  if (isRapidTapping) {
    hapticLight(); // Softer feedback
    setIsRapidMode(true);
  } else {
    hapticMedium(); // Normal feedback
  }
  
  onCounterChange(field, value + 1);
};
```

### Timestamp Chip (in CounterCard)

```typescript
// Get last tap time for this counter
const lastTapTime = counterTimestamps?.[field]?.slice(-1)[0];
const minutesSinceLastTap = lastTapTime 
  ? Math.floor((Date.now() - new Date(lastTapTime).getTime()) / 60000)
  : null;
const isStale = minutesSinceLastTap && minutesSinceLastTap > 30;
```

---

## User Experience Flow

```text
Rep opens Track page
       │
       ▼
  ┌─────────────────┐
  │ Has work_start? │
  └────────┬────────┘
           │
     No    │    Yes
     ▼     │     ▼
┌──────────┴──────────────────────────────────────────┐
│ First tap triggers "Start Your Day" prompt         │
│ OR                                                  │
│ Normal tapping with timestamp chips visible         │
└────────────────────────────────────────────────────┘
           │
           ▼
     Rep taps rapidly
           │
           ▼
  ┌─────────────────┐
  │ 5+ taps in 3s?  │
  └────────┬────────┘
           │
     Yes   │    No
     ▼     │     ▼
┌──────────┴──────────────────────────────────────────┐
│ Cooldown animation + softer haptics                 │
│ OR                                                  │
│ Normal tap experience                               │
└────────────────────────────────────────────────────┘
           │
           ▼
     10+ taps in 30s?
           │
     Yes   │
     ▼     │
┌──────────┴──────────────────────────────────────────┐
│ Educational banner slides in (once per session)     │
└────────────────────────────────────────────────────┘
```

---

## Summary
This plan introduces **progressive friction** through:
1. **Passive awareness** - Timestamp chips show logging cadence
2. **Soft friction** - Reduced haptics + animations on rapid tapping
3. **Education** - One-time banner explaining why real-time matters
4. **Behavioral moment** - "Start Your Day" creates conscious transition

All interventions prioritize education over punishment, maintaining a positive rep experience while creating natural incentives for better logging habits.

