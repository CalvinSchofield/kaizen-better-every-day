import { useCompetitionHistory } from "@/hooks/useCompetitionHistory";
import { Badge } from "@/components/ui/badge";
import { Flame, Zap, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface WinStreakBadgeProps {
  showIfZero?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const WinStreakBadge = ({ showIfZero = false, size = 'md', className }: WinStreakBadgeProps) => {
  const { data: historyData, isLoading } = useCompetitionHistory();

  if (isLoading) return null;

  const streak = historyData?.overallStats.currentWinStreak || 0;

  if (streak === 0 && !showIfZero) return null;

  const iconSize = size === 'lg' ? 'h-5 w-5' : size === 'md' ? 'h-4 w-4' : 'h-3 w-3';
  const textSize = size === 'lg' ? 'text-base' : size === 'md' ? 'text-sm' : 'text-xs';

  // Different styling based on streak length
  const getStreakStyle = () => {
    if (streak >= 5) {
      return {
        icon: Crown,
        iconClass: 'text-yellow-500',
        badgeClass: 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/50',
        label: streak >= 10 ? '🔥 DOMINATING!' : '👑 Hot Streak',
      };
    }
    if (streak >= 3) {
      return {
        icon: Flame,
        iconClass: 'text-orange-500',
        badgeClass: 'bg-orange-500/10 border-orange-500/40',
        label: 'On Fire',
      };
    }
    if (streak >= 1) {
      return {
        icon: Zap,
        iconClass: 'text-primary',
        badgeClass: 'border-primary/40',
        label: 'Streak',
      };
    }
    return null;
  };

  const style = getStreakStyle();
  if (!style) return null;

  const Icon = style.icon;

  return (
    <Badge 
      variant="outline"
      className={cn(
        "gap-1 font-medium",
        style.badgeClass,
        className
      )}
    >
      <Icon className={cn(iconSize, style.iconClass)} />
      <span className={textSize}>{streak} {style.label}</span>
    </Badge>
  );
};

// Compact version for showing in lists
export const WinStreakIndicator = ({ streak }: { streak: number }) => {
  if (streak < 2) return null;

  if (streak >= 5) {
    return (
      <span className="inline-flex items-center gap-0.5 text-yellow-600">
        <Crown className="h-3 w-3" />
        <span className="text-xs font-bold">{streak}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 text-orange-500">
      <Flame className="h-3 w-3" />
      <span className="text-xs font-medium">{streak}</span>
    </span>
  );
};
