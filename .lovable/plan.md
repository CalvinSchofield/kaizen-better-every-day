

## Fix: What-If Calculator Cancel Rate Logic

### The Problem

Your math is sound conceptually. The current code applies the summer cancel rate to the **entire goal** uniformly, which is wrong. Here's what happens now vs what should happen:

**Current code (wrong):**
```text
funded = 500 / (1 - 0.10) = 555.56
remaining = 555.56 - 103.8 = 451.76
daily = 451.76 / 129 = 3.50
```

**Your expected model (correct):**
```text
netPreseason = 103.8 × 0.95 = 98.61   ← 5% of preseason cancels
remaining = 500 - 98.61 = 401.39       ← what's left to fund
summerSell = 401.39 / (1 - 0.10) = 446.0  ← sell enough at 10% cancel
daily = 446.0 / 129 = 3.46
```

The key insight: **preseason and summer have different cancel rates**, so the buffer must be applied separately — preseason cancel rate to preseason progress, summer cancel rate only to summer sales.

One small math note: `401.39 / 0.9 = 446.0`, not `401.39 × 1.1 = 441.5`. If 10% cancel, you need to sell X where `X × 0.9 = target`, so `X = target / 0.9`. I'll use the divide formula.

### Bug 2: Weekly rounding desync

`weeklyNeeded` is rounded independently from `dailyNeeded`, so displayed weekly can differ from `daily × 6`. Fix: derive weekly from the already-rounded daily.

### Bug 3: AnimatedNumber desync

The `AnimatedNumber` component uses `AnimatePresence mode="wait"` with staggered exit/enter animations. During rapid slider movement, different tier numbers animate at different speeds, showing a mix of old and new values. Replace with instant display.

### Changes — `src/components/goals/WhatIfScenarioDrawer.tsx`

1. **Fix cancel rate calculation** in `tierResults` useMemo:
   - `netPreseason = startingPoint × (1 - baseCancelRate)` — apply preseason cancel rate to preseason progress
   - `remaining = goal - netPreseason`
   - `summerSellNeeded = remaining / (1 - summerCancelRate)` — apply summer cancel rate only to summer portion
   - `dailyNeeded = summerSellNeeded / effectiveSummerDays`

2. **Fix weekly rounding**: `roundedWeekly = roundedDaily × 6` (derive from rounded daily, not raw)

3. **Remove AnimatedNumber component** — replace with plain `<span>` for instant, reliable display

