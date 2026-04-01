# Track Page Tour Redesign — World-Class Onboarding

## Overview

Rebuild the Track tour from 6 steps into a comprehensive, state-aware experience that walks users through all three knocking states (pre-work, working, day-complete) with dummy data examples showing a real FP sale and an upgrade sale during the save flow.

## Current Problems

1. Tour only covers the "working" state — never teaches pre-work or day-complete
2. No visual example of saving a day or what the post-save screen looks like
3. Steps jump straight into counters without context about the page's adaptive states
4. Log Sale sheet steps are tightly coupled to actions that may not work well during onboarding

## Redesigned Tour Flow (8–9 steps)

### Phase 1: The Three States (context-setting)

**Step 1 — "Track Adapts to Your Day"**

- Target: `track-pre-work-state` (the PreWorkingState container)
- Description: "Track has three modes: before you start, while you're knocking, and after you save your day. Right now you're in Pre-Work mode — let's walk through it."

**Step 2 — "Start Your Day"**

- Target: `track-start-button` (the Start Knocking button in PreWorkingState)
- Description: "When you're ready to hit doors, tap this button. It starts your clock, which will help you get an idea of how much money make per hour as he continue to track and sell!"

### Phase 2: Active Working Mode

**Step 3 — "Your Time Clock"**

- Target: `track-time-bar` (TimeTrackingBar)
- Action: auto-start the timer (or simulate it) so the UI transitions to working state
- Description: "Your hours are tracked automatically. Tap pause for lunch or breaks — it keeps your actual knocking time accurate."

**Step 4 — "Count Your Activity"**

- Target: `track-counter-grid` (QTallyGrid)
- Description: "Tap any counter to add one. swipe down to subtract. Doors, pitches, presentations, closes — everything saves automatically as you go."

**Step 5 — "Log Your Sales"**

- Target: `track-fp-counter` (the FP+/sales counter)
- Description: "This is the big one. Each time you close a deal, tap here to log it. You'll choose FP or Upgrade and enter the PRMR."

### Phase 3: Log Sale Sheet (with dummy data)

**Step 6 — "FP or Upgrade?"**

- Target: `track-sale-type-toggle`
- Action: `openLogSaleSheet` — opens the sheet
- Description: "Choose 'FP' for brand-new accounts or 'Upgrade' when adding equipment to an existing customer. Let's see how it works."
- lightOverlay: true

**Step 7 — "PRMR Help"**

- Target: `track-prmr-help-button`
- Action: `switchToUpgradeAndShowHelp`
- Description: "Not sure about the PRMR? Tap the ? icon. For upgrades, it opens a calculator — just type what you sold and it does the math."
- lightOverlay: true

### Phase 4: Day Complete Preview

**Step 8 — "Save & Review Your Day"**

- Target: `track-save-button` (the End/Save Day button in TimeTrackingBar or header)
- Description: "When you're done knocking, tap 'End Day' to save. You'll see a summary of your activity, your sales, and how you're tracking against your goals."

**Step 9 — "Your Day Complete View"**

- Target: `track-day-complete-preview` (a new dummy preview card we render during the tour)
- Description: "After saving, Track transforms into your day recap — an activity ring, your stats, coaching insights, and how today moved you toward your goal. Here's what a great day looks like!"
- This step