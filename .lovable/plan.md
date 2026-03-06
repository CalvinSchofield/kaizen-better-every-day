

## Fix: iOS Keyboard Pushing Content Up with Large Empty Gap

### The Problem

When tapping into an input field in the Capacitor TestFlight app, the entire page content gets pushed way up -- the input field scrolls off the top of the screen, leaving a massive empty gap between the remaining visible content and the keyboard. Closing and reopening the keyboard 2-3 times eventually settles it.

### Root Cause

There are three things fighting each other:

1. **`html` and `body` are both `position: fixed; height: 100%; overflow: hidden`** (index.css lines 196-203). When the keyboard opens, WKWebView's visual viewport shrinks, but these fixed elements don't naturally adjust.

2. **The `useKeyboardViewport` hook forces `html`, `body`, and `#root` height to `--visual-viewport-height`** via the `.keyboard-open` CSS class (lines 231-247). This aggressively shrinks the entire layout container to the visible area above the keyboard, causing the massive content jump on the first open. On subsequent opens, the values are closer to correct so the jump is smaller.

3. **The hook's `focusin` handler calls `scrollIntoView` at 50ms**, and the resize handler calls `scrollIntoView` again at 100ms. These two programmatic scrolls race with WKWebView's own keyboard animation, causing erratic content positioning.

### The Fix

#### 1. Remove the aggressive `.keyboard-open` CSS height constraints

The rules that force `html`, `body`, and `#root` to `--visual-viewport-height` are the primary cause of the content jump. Remove them entirely. The page layout should remain stable when the keyboard opens.

#### 2. Simplify `useKeyboardViewport` hook

- **Remove the `focusin` event handler** that calls `scrollIntoView` before the keyboard even opens
- **Remove the `scrollIntoView` call inside the resize handler** -- let WKWebView handle scrolling to the focused input natively
- **Keep only the CSS variable updates** (`--keyboard-height`) so components like bottom navigation can hide/adjust when the keyboard is open
- **Add a settling delay** -- wait 300ms after detecting keyboard open before applying the CSS variable, to avoid reacting to intermediate viewport sizes during the keyboard animation

#### 3. Add `@capacitor/keyboard` plugin configuration

Add the plugin to `capacitor.config.ts` with `resize: "none"` so WKWebView does not resize the web view when the keyboard opens. This prevents the double-resize problem (native resize + JS resize fighting).

### Files to Modify

- **`src/index.css`** -- Remove the `.keyboard-open` height-forcing rules (lines 231-247)
- **`src/hooks/useKeyboardViewport.ts`** -- Strip down to only set `--keyboard-height` CSS variable; remove all `scrollIntoView` calls and the `focusin` handler; add settling delay
- **`capacitor.config.ts`** -- Add Keyboard plugin config with `resize: "none"`
- **`package.json`** -- Add `@capacitor/keyboard` dependency

### After Approval

After these code changes, you will need to:
1. Git pull the updated code
2. Run `npm install` to get the new keyboard plugin
3. Run `npx cap sync` to sync the plugin to iOS
4. Rebuild in Xcode and push to TestFlight

