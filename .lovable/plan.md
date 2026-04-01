# Full-Screen Badge Celebration Overlay

## Concept

When a badge is earned, display a full-screen dark overlay with the badge emoji rendered large and centered, gold confetti particles, the badge name, description, rarity label, and a "Continue" button to dismiss. Inspired by the Duolingo achievement screen and the reference images — dark background, large centered emblem, gold particle effects, clean typography. AND haptic feedback

## Architecture

Use the same global event bus pattern as `InAppNotificationBanner`. A new `BadgeCelebrationOverlay` component is mounted once in `App.tsx` and listens for badge-earned events. When `awardBadge` in `useBadgeDetection.ts` successfully inserts a badge, it emits the event (instead of / in addition to the toast). Multiple badges earned in sequence are queued and shown one at a time.

## Design Details

- **Background**: Fixed full-screen overlay, `bg-black/95` with backdrop blur
- **Badge emblem**: The emoji rendered at ~120px inside a rounded pill/capsule shape with a subtle dark gradient background and a gold glow ring (matching rarity color). Entrance animation: scale from 0 + rotate, similar to the reference "Day 1" image
- **Rarity glow**: Border ring color matches rarity (gold/amber for legendary, purple for epic, blue for rare, neutral for common)
- **Text**: Badge name in bold white, description in muted gray below, rarity label as a small uppercase tag
- **Confetti**: Fire `canvas-confetti` with rarity-matched colors (gold for legendary/epic, blue for rare, standard for common) + haptic feedback
- **Dismiss**: "Continue" button at bottom + tap anywhere to dismiss. Auto-dismiss after 8 seconds if no interaction.
- **Queue**: If multiple badges are earned at once (common — daily FP badges stack), show them sequentially with a brief 400ms gap between

## Files to Change

1. `**src/components/badges/BadgeCelebrationOverlay.tsx**` (new) — Full-screen overlay component with Framer Motion animations, confetti integration, and event listener
2. `**src/hooks/useBadgeDetection.ts**` — Replace the `toast()` call in `awardBadge` with an event emission to the celebration overlay. Keep the query invalidation.
3. `**src/App.tsx**` — Mount `BadgeCelebrationOverlay` alongside `InAppNotificationBanner`

## Animation Sequence (per badge)

1. Overlay fades in (200ms)
2. Badge emblem scales up from 0 with spring physics (400ms)
3. Confetti burst fires (rarity-matched colors)
4. Haptic feedback fires
5. Title + description fade in staggered (300ms delay)
6. "Continue" button fades in (500ms delay)
7. On dismiss: everything scales down + fades out (200ms)