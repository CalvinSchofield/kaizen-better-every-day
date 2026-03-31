import { useState, useMemo } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { BadgeIcon } from "./BadgeIcon";
import { BadgeDetailSheet } from "./BadgeDetailSheet";
import { RARITY_PRIORITY, RARITY_COLORS } from "@/utils/badgeDefinitions";
import type { UserBadge, BadgeDefinition } from "@/hooks/useUserBadges";

interface BadgeGridProps {
  earnedBadges: UserBadge[];
  allDefinitions: BadgeDefinition[];
  isOwnProfile: boolean;
}

export const BadgeGrid = ({ earnedBadges, allDefinitions, isOwnProfile }: BadgeGridProps) => {
  const [selectedBadge, setSelectedBadge] = useState<(UserBadge | BadgeDefinition) | null>(null);
  const [isSelectedEarned, setIsSelectedEarned] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);

  // Count how many times each badge slug was earned
  const earnedCountMap = useMemo(() => {
    const map = new Map<string, number>();
    earnedBadges.forEach(b => map.set(b.slug, (map.get(b.slug) || 0) + 1));
    return map;
  }, [earnedBadges]);

  const earnedSlugs = useMemo(() => new Set(earnedBadges.map(b => b.slug)), [earnedBadges]);

  // Group by category
  const categories = useMemo(() => {
    const order = ['milestone', 'club', 'streak', 'special', 'competition'];
    const labels: Record<string, string> = {
      milestone: 'Milestones',
      club: 'Season Clubs',
      streak: 'Streaks',
      special: 'Special',
      competition: 'Competitions',
    };

    return order.map(cat => {
      const defs = allDefinitions.filter(d => d.category === cat);
      const earned = earnedBadges.filter(b => b.category === cat);
      return {
        key: cat,
        label: labels[cat] || cat,
        items: defs.map(def => ({
          definition: def,
          earned: earned.find(e => e.slug === def.slug) || null,
          earnedCount: earnedCountMap.get(def.slug) || 0,
        })),
      };
    }).filter(c => c.items.length > 0);
  }, [allDefinitions, earnedBadges, earnedCountMap]);

  const handleTap = (def: BadgeDefinition, earned: UserBadge | null, count: number) => {
    if (earned) {
      setSelectedBadge(earned);
      setIsSelectedEarned(true);
      setSelectedCount(count);
    } else if (!def.isHidden || isOwnProfile) {
      setSelectedBadge(def);
      setIsSelectedEarned(false);
      setSelectedCount(0);
    }
  };

  return (
    <div className="space-y-5">
      {categories.map(cat => (
        <div key={cat.key}>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {cat.label}
          </h4>
          <div className="flex flex-wrap gap-2">
            {cat.items.map(({ definition: def, earned, earnedCount }) => {
              const isEarned = !!earned;
              const isHiddenAndLocked = def.isHidden && !isEarned;

              return (
                <button
                  key={def.slug}
                  onClick={() => handleTap(def, earned, earnedCount)}
                  className={cn(
                    "relative rounded-full transition-all active:scale-90",
                    !isEarned && "opacity-30 grayscale"
                  )}
                >
                  {isHiddenAndLocked ? (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center border border-border">
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    </div>
                  ) : (
                    <BadgeIcon
                      emoji={def.iconEmoji}
                      rarity={isEarned ? def.rarity : 'common'}
                      size="md"
                    />
                  )}
                  {earnedCount > 1 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center leading-none">
                      {earnedCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {earnedBadges.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No badges earned yet. Keep grinding!
        </p>
      )}

      <BadgeDetailSheet
        open={!!selectedBadge}
        onOpenChange={(open) => !open && setSelectedBadge(null)}
        badge={selectedBadge}
        isEarned={isSelectedEarned}
        earnedCount={selectedCount}
      />
    </div>
  );
};
