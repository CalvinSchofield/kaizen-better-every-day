

# Settings Page Redesign — World-Class Mobile App

## Current State
The Settings page is 1814 lines of monolithic code with a flat list of Card+Collapsible sections. It looks like a generic form page, not a polished mobile settings experience. There's also a build error that needs fixing first.

## Design Vision
Model it after iOS/Android settings pages: grouped rows with icons, clean section headers, subtle separators, and tap-to-navigate rows. Think Apple Settings or Spotify's settings — no bulky cards, no collapsible chevrons everywhere.

## Architecture

```text
┌─────────────────────────────────┐
│  Profile Hero (photo + name)    │
│  ────────────────────────────── │
│  ACCOUNT                        │
│  ☀️  Summer Season  ›  Apr–Sep  │
│  🎯  Preseason Commitments  ›   │
│  ────────────────────────────── │
│  TRACKING (vets only)           │
│  📊  EFP Mode          [toggle] │
│  📉  Cancel Rate         10%  › │
│  🔢  Custom Counters       3  › │
│  📋  Sales Logger      [toggle] │
│  ────────────────────────────── │
│  ME VS ME (vets only)           │
│  🏆  Me vs Me          [toggle] │
│  ────────────────────────────── │
│  NOTIFICATIONS                  │
│  🔔  Push Notifications    ›    │
│  ────────────────────────────── │
│  RECAPS                         │
│  📊  Pay Level            100›  │
│  📖  Past Recaps            ›   │
│  ✨  Team Recaps            ›   │
│  ────────────────────────────── │
│  ABOUT                          │
│  🔄  Replay Intro           ›   │
│  🗺️  Reset Page Tours       ›   │
│  🧪  Developer Tools        ›   │ (Calvin only)
│  ────────────────────────────── │
│  Sign Out                        │
└─────────────────────────────────┘
```

## Plan

### 1. Create a reusable `SettingsRow` component
A single row with icon, title, subtitle, and a right-side accessory (chevron, toggle, value badge). Used for every item on the page.

### 2. Create a `SettingsSection` component
Renders a section label + a rounded container with dividers between rows. Like iOS grouped table sections.

### 3. Rebuild the Profile hero
Large centered avatar with camera overlay, editable name below it, and the rep's role/year as a subtitle. Clean, minimal.

### 4. Refactor Settings.tsx into grouped sections
- Extract all handler logic into the same file but organize the JSX into clean `SettingsSection` blocks
- Inline toggles for simple on/off settings (EFP mode, Sales Logger)
- Navigation rows (chevron ›) for complex settings that open Drawers: Summer Dates, Cancel Rate, Custom Counters, Notifications, Recaps
- Keep existing Drawer-based editing UIs but trigger them from clean rows instead of collapsibles

### 5. Style the page
- Remove all Card wrappers — use full-width grouped rows with `bg-card rounded-xl` per section
- Section headers: uppercase, small, muted text with left padding
- Rows: 56px height, consistent padding, right-aligned accessories
- Subtle dividers between rows (not between sections)
- Page background stays `bg-background`

### 6. Fix build error
Investigate and resolve the current build failure before applying changes.

## Technical Details

**New files:**
- `src/components/settings/SettingsRow.tsx` — Reusable row (icon, title, subtitle, accessory slot)
- `src/components/settings/SettingsSection.tsx` — Section wrapper with label

**Modified files:**
- `src/pages/Settings.tsx` — Complete rewrite of JSX structure; all existing handlers/state preserved, just reorganized

**No database changes needed.** All existing functionality (save profile, toggle EFP, counters, notifications, recaps) remains identical — only the presentation layer changes.

