

# Wrap All Pages in Layout for Consistent Navigation

## Problem
13 pages currently lack the global `<Layout>` wrapper, meaning they have no bottom nav bar, no hamburger menu, and no drawer access. Users get "stuck" on these pages with only a back button. Profile is the worst offender with floating buttons that feel disconnected.

## Pages to Wrap

| Page | Current Header | Approach |
|------|---------------|----------|
| **Profile** | Floating back + settings buttons over hero photo | Wrap in Layout, remove floating buttons, move hero below header |
| **LogSale** | Custom sticky header with Cancel button | Wrap in Layout, remove custom header, use `useHeader` for title |
| **RampToBlitz** | EdgeSwipeContainer + back button (already uses `useHeader`) | Wrap in Layout in App.tsx, remove custom back button + EdgeSwipeContainer, already sets title via `useHeader` |
| **AboutTeam** | Floating back button | Wrap in Layout, remove floating button |
| **AddApplicant** | EdgeSwipeContainer + back + title | Wrap in Layout, remove custom header, use `useHeader` |
| **AddRecruit** | EdgeSwipeContainer + back + title | Wrap in Layout, remove custom header, use `useHeader` |
| **RecruitingContent** | EdgeSwipeContainer + back + title | Wrap in Layout, remove custom header, use `useHeader` |
| **AdminBlitzes** | EdgeSwipeContainer + back + title + "New Blitz" button | Wrap in Layout, remove custom header, use `useHeader` for title, move "New Blitz" to `headerRightContent` |
| **Competitors** | Custom sticky header + search | Wrap in Layout, remove back button header, keep search below |
| **Contacts** | Custom header | Wrap in Layout, remove custom header |
| **Objections** | Custom sticky header | Wrap in Layout, remove custom header |
| **UpgradeCheatSheet** | Custom sticky header | Wrap in Layout, remove custom header |
| **PackageBuilder** | Custom header | Wrap in Layout, remove custom header |
| **ProductKnowledge** | EdgeSwipeContainer + custom header | Wrap in Layout, remove custom header |

## Implementation Details

### 1. Layout Changes
- **`getPageTitle()`**: Add cases for all new routes (`/profile` -> "Profile", `/log-sale` -> "Log Sale", `/ramp-to-blitz` -> "Ramp to Blitz", `/about-team` -> "About Team", `/add-applicant` -> "Add Applicant", `/add-recruit` -> "Add Recruit", `/recruiting-content` -> "Recruiting", `/admin/blitzes` -> "Manage Blitzes", `/tools/competitors` -> "Competitors", `/tools/contacts` -> "Contacts", `/tools/objections` -> "Objections", `/tools/upgrades` -> "Upgrades", `/tools/package-builder` -> "Package Builder", `/tools/product-knowledge` -> "Product Knowledge")
- **Fix "Personalize"** -> "Settings" in `getPageTitle()` (line 303)
- **Handle `/profile/:userId`**: Use `startsWith` matching for dynamic routes

### 2. App.tsx Route Changes
Wrap all 13 unwrapped routes in `<Layout>`:
```tsx
<Route path="/profile/:userId" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
```

### 3. Per-Page Cleanup (remove custom headers)
Each page gets its custom header removed (the sticky div with back button + title). The page content starts directly. Pages using `EdgeSwipeContainer` just for the back gesture can keep it but lose the custom header.

**Profile** (biggest change):
- Remove the floating back/settings buttons (lines 100-119)
- Remove the top gradient fade (line 141) since header handles the top
- Remove `pt-safe` padding since Layout handles safe area
- Add camera button for own profile in `headerRightContent` via `useHeader`
- Settings icon for own profile moves to `customRightContent` via `useHeader`
- Hero photo keeps its visual design but no longer bleeds under status bar

**LogSale**:
- Remove the sticky header with Cancel/title (lines 394-412)
- Use `useHeader` to set title to "Log Sale" or "Edit Sale"
- Add Cancel button as `customRightContent`

**AdminBlitzes**:
- Move "New Blitz" button to `headerRightContent` via `useHeader`

### 4. Files Changed
- `src/components/Layout.tsx` — expand `getPageTitle()`, fix "Personalize" -> "Settings"
- `src/App.tsx` — wrap 13 routes in `<Layout>`
- `src/pages/Profile.tsx` — remove floating buttons, adjust hero layout
- `src/pages/LogSale.tsx` — remove custom header, use `useHeader`
- `src/pages/RampToBlitz.tsx` — remove back button, already uses `useHeader`
- `src/pages/AboutTeam.tsx` — remove floating back button
- `src/pages/AddApplicant.tsx` — remove custom header, use `useHeader`
- `src/pages/AddRecruit.tsx` — remove custom header, use `useHeader`
- `src/pages/RecruitingContent.tsx` — remove custom header, use `useHeader`
- `src/pages/AdminBlitzes.tsx` — remove custom header, use `useHeader`
- `src/pages/Competitors.tsx` — remove back button header
- `src/pages/Objections.tsx` — remove custom header
- `src/pages/UpgradeCheatSheet.tsx` — remove custom header
- `src/pages/PackageBuilder.tsx` — remove custom header
- `src/pages/ProductKnowledge.tsx` — remove custom header

~16 files total. This is a large but mechanical change — each page follows the same pattern: wrap in Layout, delete custom header, optionally use `useHeader` for dynamic titles or right-side actions.

