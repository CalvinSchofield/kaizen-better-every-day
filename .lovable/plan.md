## Plan: Fix Sale Duration Override & Presentation Splitting

### Problem 1: Sale Duration Being Ignored

The user logged a 30-minute sale at 12:52 PM, but the ring shows ~50 minutes (from the nearest door knock to the sale time). The explicit `time_to_sell_minutes` path should place the green zone from 12:22→12:52, but it's falling through to the timestamp-based fallback.

**Root cause**: When `time_to_sell_minutes` is stored as a string in the JSON (e.g., `"30"` instead of `30`), the `Number()` coercion happens implicitly but there may be edge cases. More critically, the event-building code in `HorizontalActivityTimeline.tsx` passes `saleAny.time_to_sell_minutes` directly — if the sale was saved without CRM detailed mode, or the value is `0`/`undefined`, it silently falls through to Priority 2 (door-to-sale timestamp gap).

**Fix** in `src/utils/inHomeZoneCalculator.ts` and `src/components/activity-ring/HorizontalActivityTimeline.tsx`:

- Add explicit `Number()` coercion when building events: `timeToSellMinutes: Number(sale.time_to_sell_minutes) || undefined`
- Add a debug-friendly log in Priority 1 path for verification
- The explicit path already correctly places the zone BEFORE the timestamp (subtracting duration), so the core math is right — it's just not being reached

### Problem 2: Two Presentations Lumped Into One

Two separate homeowner interactions near end of day are shown as one ~2hr presentation because the algorithm finds the earliest unused door knock and spans all the way to the presentation timestamp.

**Root cause**: In `calculateInHomeZones`, Priority 2 finds the nearest unused door BEFORE the presentation, regardless of how far back it is. If doors were knocked BETWEEN two presentations, those intervening doors should signal separate interactions.

**Fix** in `src/utils/inHomeZoneCalculator.ts`:

- When matching a door to a presentation/close via Priority 2 (timestamp-based), check for **intervening in-home indicators** (other presentations, transitions, sales) between the matched door and the current indicator. If found, skip that door — it belongs to the earlier indicator.
- Additionally, cap maximum zone duration for timestamp-based zones. A presentation rarely lasts >90 minutes. If the door-to-indicator gap exceeds 90 min, either:
  - Look for a closer door (even if used)
  - Or use estimated default duration (30 min for presentations) anchored backward from the indicator timestamp
- Also check for intervening **door knocks** between the matched door and the presentation. If there are N doors knocked between the matched door and the presentation event, it means the rep went back to knocking and then entered a new home — the zone should start from the last door before the presentation, not the first.

### Implementation Details

**File: `src/components/activity-ring/HorizontalActivityTimeline.tsx**`

- Ensure `timeToSellMinutes` is properly coerced: `Number(sale.time_to_sell_minutes) || undefined`

**File: `src/utils/inHomeZoneCalculator.ts**` — `calculateInHomeZones()`:

1. **Explicit duration enforcement**: Add `Number()` coercion on `indicator.timeToSellMinutes` before the check
2. **Intervening activity check**: After finding `bestDoorIdx`, verify no other door knocks exist between that door's timestamp and the current indicator's timestamp. If intervening doors exist, use the LAST door before the indicator instead (it's the one that actually led to this interaction