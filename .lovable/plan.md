

## Plan: Redesign Invite Share Flow

### Problems
1. **Infinite loading on TestFlight**: In a native Capacitor app, `window.location.origin` returns `capacitor://localhost` (iOS), making the invite link invalid and the Supabase query may also behave differently. The link must always use the published URL.
2. **UX feels like onboarding, not sharing**: The current flow shows the raw URL, has an "Invite to Sign Up" header, and feels transactional rather than like sharing a cool app.
3. **User wants**: Two clear options in the `+` sheet, then immediate share/copy actions without showing the link itself, plus a compelling share message.

### Changes

#### 1. Fix invite link URL (all files that generate links)
**Files**: `AddRecruitActionSheet.tsx`, `ShareInviteLinkButton.tsx`

Replace `window.location.origin` with a hardcoded published app URL constant:
```typescript
const APP_BASE_URL = 'https://kaizen-better-every-day.lovable.app';
```
This ensures invite links always point to the real app regardless of whether the