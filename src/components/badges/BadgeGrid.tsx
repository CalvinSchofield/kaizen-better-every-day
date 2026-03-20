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
        })),
      };
    }).filter(c => c.items.length > 0);
  }, [allDefinitions, earnedBadges]);

  const handleTap = (def: BadgeDefinition, earned: UserBadge | null) => {
    if (earned) {
      setSelectedBadge(earned);
      setIsSelectedEarned(true);
    } else if (!def.isHidden || isOwnProfile) {
      setSelectedBadge(def);
      setIsSelectedEarned(false);
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
            {cat.items.map(({ definition: def, earned }) => {
              const isEarned = !!earned;
              const isHiddenAndLocked = def.isHidden && !isEarned;

              return (
                <button
                  key={def.slug}
                  onClick={() => handleTap(def, earned)}
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
      />
    </div>
  );
};
