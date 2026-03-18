import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Target, TrendingUp, AlertTriangle, XCircle, HelpCircle, Calendar, ChevronRight, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFirstName } from "@/components/mygroup/recruit-detail/utils";
import { getInitials } from "@/utils/nameUtils";
import { EnhancedGoalPaceResult } from "@/hooks/useReportsV2Data";
import { GOAL_TIER_CONFIG, GoalTier } from "@/config/goalTiers";

interface GoalPaceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enhancedGoalPace: EnhancedGoalPaceResult[];
  onRepClick?: (userId: string) => void;
}

type FilterStatus = 'all' | 'on_pace' | 'at_risk' | 'behind' | 'no_goals' | 'needs_planning';

const STATUS_CONFIG = {
  on_pace: { label: 'On Pace', icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  at_risk: { label: 'At Risk', icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  behind: { label: 'Behind', icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  no_goals: { label: 'No Goals', icon: HelpCircle, color: 'text-muted-foreground', bg: 'bg-muted/50', border: 'border-muted' },
  needs_planning: { label: 'Plan Days', icon: Calendar, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
};

const TIER_ORDER: GoalTier[] = ['preseason', 'mustDo', 'willDo', 'couldDo'];

const FilterChip = ({ active, onClick, label, colorClass }: { active: boolean; onClick: () => void; label: string; colorClass?: string }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
      active
        ? cn("bg-primary text-primary-foreground", colorClass)
        : "bg-muted/50 text-muted-foreground hover:bg-muted"
    )}
  >
    {label}
  </button>
);

const RepGoalCard = ({ rep, onRepClick }: { rep: EnhancedGoalPaceResult; onRepClick?: (userId: string) => void }) => {
  const statusConfig = STATUS_CONFIG[rep.status];
  const StatusIcon = statusConfig.icon;
  const tiers = TIER_ORDER.filter(t => rep.allGoals[t]);

  return (
    <div
      className={cn(
        "p-3 rounded-xl border cursor-pointer transition-all active:scale-[0.98]",
        statusConfig.bg, statusConfig.border,
        rep.needsPlanning && "ring-1 ring-blue-500/40"
      )}
      onClick={() => onRepClick?.(rep.userId)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {getInitials(rep.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <span className="font-semibold text-sm">{getFirstName(rep.name)}</span>
            {rep.focusTier && (
              <div className="flex items-center gap-1 mt-0.5">
                <Badge variant="outline" className={cn("text-[8px] px-1 py-0", GOAL_TIER_CONFIG[rep.focusTier].color, GOAL_TIER_CONFIG[rep.focusTier].borderColor)}>
                  {GOAL_TIER_CONFIG[rep.focusTier].shortLabel} Focus
                </Badge>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusIcon className={cn("w-4 h-4", statusConfig.color)} />
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
        </div>
      </div>

      {/* Pace context */}
      <div className="flex items-baseline gap-4 mb-3 px-1">
        <div>
          <span className="text-[10px] text-muted-foreground">Avg</span>
          <div className="text-sm font-bold">{rep.userDailyAvg.toFixed(1)}<span className="text-[10px] text-muted-foreground font-normal">/day</span></div>
        </div>
        <div>
          <span className="text-[10px] text-muted-foreground">Need</span>
          <div className={cn(
            "text-sm font-bold",
            rep.dailyNeeded > rep.userDailyAvg * 1.2 ? "text-red-600 dark:text-red-400" : "text-foreground"
          )}>
            {rep.dailyNeeded.toFixed(1)}<span className="text-[10px] text-muted-foreground font-normal">/day</span>
          </div>
        </div>
        <div>
          <span className="text-[10px] text-muted-foreground">YTD</span>
          <div className="text-sm font-bold">{rep.ytdFP.toFixed(1)}<span className="text-[10px] text-muted-foreground font-normal"> FP+</span></div>
        </div>
      </div>

      {/* Multi-tier progress bars */}
      {tiers.length > 0 && (
        <div className="space-y-1.5">
          {tiers.map(tier => {
            const tierData = rep.allGoals[tier]!;
            const config = GOAL_TIER_CONFIG[tier];
            const isFocus = tier === rep.focusTier;

            return (
              <div key={tier} className="flex items-center gap-2">
                <span className={cn("text-[10px] w-14 text-right font-medium", isFocus ? config.color : "text-muted-foreground")}>
                  {config.shortLabel}
                </span>
                <div className="flex-1 relative h-1.5 bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full transition-all",
                      isFocus ? `bg-gradient-to-r ${config.gradient}` : "bg-muted-foreground/30"
                    )}
                    style={{ width: `${tierData.percent}%` }}
                  />
                </div>
                <span className={cn("text-[10px] w-10 font-medium", isFocus ? config.color : "text-muted-foreground")}>
                  {Math.round(tierData.percent)}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Planning warning */}
      {rep.needsPlanning && (
        <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-1.5 text-[10px] text-blue-600 dark:text-blue-400">
          <Calendar className="w-3 h-3" />
          Only {rep.futurePlannedDays} days planned — needs more
        </div>
      )}
    </div>
  );
};

export const GoalPaceDrawer = ({ open, onOpenChange, enhancedGoalPace, onRepClick }: GoalPaceDrawerProps) => {
  const [filter, setFilter] = useState<FilterStatus>('all');

  const counts = {
    on_pace: enhancedGoalPace.filter(r => r.status === 'on_pace').length,
    at_risk: enhancedGoalPace.filter(r => r.status === 'at_risk').length,
    behind: enhancedGoalPace.filter(r => r.status === 'behind').length,
    no_goals: enhancedGoalPace.filter(r => r.status === 'no_goals').length,
    needs_planning: enhancedGoalPace.filter(r => r.needsPlanning).length,
  };

  let filtered = enhancedGoalPace;
  if (filter === 'needs_planning') {
    filtered = enhancedGoalPace.filter(r => r.needsPlanning);
  } else if (filter !== 'all') {
    filtered = enhancedGoalPace.filter(r => r.status === filter);
  }

  const sorted = [...filtered].sort((a, b) => {
    const order = { behind: 0, at_risk: 1, on_pace: 2, no_goals: 3 };
    return order[a.status] - order[b.status];
  });

  const withGoals = sorted.filter(r => r.status !== 'no_goals');
  const noGoalsReps = sorted.filter(r => r.status === 'no_goals');

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Goal Pace
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-6 overflow-y-auto space-y-4">
          {/* Filter chips */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4">
            <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label={`All (${enhancedGoalPace.length})`} />
            {(['on_pace', 'at_risk', 'behind', 'no_goals', 'needs_planning'] as const)
              .filter(s => counts[s] > 0)
              .map(s => (
                <FilterChip
                  key={s}
                  active={filter === s}
                  onClick={() => setFilter(filter === s ? 'all' : s)}
                  label={`${STATUS_CONFIG[s].label} (${counts[s]})`}
                  colorClass={filter === s ? STATUS_CONFIG[s].bg : undefined}
                />
              ))}
          </div>

          {/* Rep Cards with Goals */}
          {withGoals.length > 0 && (
            <div className="space-y-3">
              {withGoals.map(rep => (
                <RepGoalCard key={rep.userId} rep={rep} onRepClick={onRepClick} />
              ))}
            </div>
          )}

          {/* No Goals Section */}
          {noGoalsReps.length > 0 && (filter === 'all' || filter === 'no_goals') && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                No Goals Set ({noGoalsReps.length})
              </div>
              <div className="space-y-2">
                {noGoalsReps.map(rep => (
                  <div
                    key={rep.userId}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-all"
                    onClick={() => onRepClick?.(rep.userId)}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                          {getInitials(rep.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm">{getFirstName(rep.name)}</span>
                    </div>
                    {rep.phone && (
                      <button
                        className="text-xs text-primary flex items-center gap-1 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`sms:${rep.phone}?body=${encodeURIComponent("Hey! Time to set your goals 🎯")}`);
                        }}
                      >
                        <MessageSquare className="w-3 h-3" />
                        Remind
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sorted.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No reps match this filter</p>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
