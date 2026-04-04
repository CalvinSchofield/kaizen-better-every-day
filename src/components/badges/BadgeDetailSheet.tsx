import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BadgeIcon } from "./BadgeIcon";
import { format, parseISO } from "date-fns";
import type { UserBadge, BadgeDefinition } from "@/hooks/useUserBadges";

interface BadgeDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badge: (UserBadge | BadgeDefinition) | null;
  isEarned: boolean;
  earnedCount?: number;
  globalCount?: number;
}

export const BadgeDetailSheet = ({ open, onOpenChange, badge, isEarned, earnedCount = 0, globalCount }: BadgeDetailSheetProps) => {
  if (!badge) return null;

  const earnedAt = isEarned && 'earnedAt' in badge ? badge.earnedAt : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8">
        <SheetHeader className="items-center pt-4">
          <BadgeIcon
            emoji={badge.iconEmoji}
            rarity={badge.rarity}
            size="lg"
          />
          <SheetTitle className="text-center mt-3">{badge.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3 text-center">
          {badge.description && (
            <p className="text-sm text-muted-foreground">{badge.description}</p>
          )}

          <div className="flex items-center justify-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
              {badge.rarity}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
              {badge.category}
            </span>
          </div>

          {globalCount !== undefined && globalCount > 0 && (
            <p className="text-xs font-semibold text-primary">
              {globalCount === 1
                ? "Only 1 rep has earned this badge"
                : `Only ${globalCount} reps have earned this badge`}
            </p>
          )}

          {isEarned && earnedCount > 1 && (
            <p className="text-sm font-semibold text-foreground">
              Earned {earnedCount}× 🔥
            </p>
          )}

          {isEarned && earnedAt && (
            <p className="text-xs text-primary font-medium">
              {earnedCount > 1 ? 'Most recent: ' : 'Earned '}
              {format(parseISO(earnedAt), "MMM d, yyyy")}
            </p>
          )}

          {!isEarned && (
            <p className="text-xs text-muted-foreground italic">
              {badge.isHidden ? "🔒 Hidden — keep pushing to unlock!" : "Not yet earned"}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
