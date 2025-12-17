import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, TrendingDown, Minus, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface RepPaceData {
  userId: string;
  notionPageId: string;
  name: string;
  year: string;
  currentFp: number;
  willDoGoal: number;
  mustDoGoal: number;
  couldDoGoal: number;
  pacePercentage: number;
  dailyTarget: number;
  daysRemaining: number;
  status: 'ahead' | 'on-track' | 'behind' | 'critical';
}

interface GoalsPaceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reps: RepPaceData[];
  onRepClick?: (notionPageId: string) => void;
}

const STATUS_CONFIG = {
  ahead: { 
    icon: TrendingUp, 
    label: 'Ahead', 
    bgColor: 'bg-emerald-500/10', 
    textColor: 'text-emerald-600',
    borderColor: 'border-emerald-500/30',
    progressColor: 'bg-emerald-500'
  },
  'on-track': { 
    icon: Minus, 
    label: 'On Track', 
    bgColor: 'bg-blue-500/10', 
    textColor: 'text-blue-600',
    borderColor: 'border-blue-500/30',
    progressColor: 'bg-blue-500'
  },
  behind: { 
    icon: TrendingDown, 
    label: 'Behind', 
    bgColor: 'bg-amber-500/10', 
    textColor: 'text-amber-600',
    borderColor: 'border-amber-500/30',
    progressColor: 'bg-amber-500'
  },
  critical: { 
    icon: TrendingDown, 
    label: 'Critical', 
    bgColor: 'bg-red-500/10', 
    textColor: 'text-red-600',
    borderColor: 'border-red-500/30',
    progressColor: 'bg-red-500'
  },
};

export const GoalsPaceDrawer = ({ open, onOpenChange, reps, onRepClick }: GoalsPaceDrawerProps) => {
  // Group by status for summary
  const statusCounts = reps.reduce((acc, rep) => {
    acc[rep.status] = (acc[rep.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Sort: critical first, then behind, then on-track, then ahead
  const sortedReps = [...reps].sort((a, b) => {
    const order = { critical: 0, behind: 1, 'on-track': 2, ahead: 3 };
    return order[a.status] - order[b.status];
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Goals & Pace
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4 overflow-y-auto">
          {/* Status Summary */}
          <div className="flex gap-2 flex-wrap">
            {Object.entries(statusCounts).map(([status, count]) => {
              const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
              return (
                <Badge
                  key={status}
                  variant="outline"
                  className={cn("text-xs", config.bgColor, config.textColor, config.borderColor)}
                >
                  {count} {config.label}
                </Badge>
              );
            })}
          </div>

          {/* Rep Grid */}
          <div className="grid gap-3">
            {sortedReps.map((rep) => {
              const config = STATUS_CONFIG[rep.status];
              const Icon = config.icon;
              const progressPercent = Math.min((rep.currentFp / rep.willDoGoal) * 100, 100);
              const firstName = rep.name?.split(' ')[0] || 'Rep';

              return (
                <div
                  key={rep.userId}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all cursor-pointer hover:scale-[1.01]",
                    config.bgColor,
                    config.borderColor
                  )}
                  onClick={() => onRepClick?.(rep.notionPageId)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{firstName}</span>
                        <Badge variant="outline" className="text-xs">
                          {rep.year}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {rep.daysRemaining} days remaining
                      </div>
                    </div>
                    <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full", config.bgColor)}>
                      <Icon className={cn("h-4 w-4", config.textColor)} />
                      <span className={cn("text-sm font-medium", config.textColor)}>
                        {Math.round(rep.pacePercentage)}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{rep.currentFp.toFixed(1)} FP+</span>
                      <span className="text-muted-foreground">/ {rep.willDoGoal} Will Do</span>
                    </div>
                    <div className="relative h-2.5 bg-muted/50 rounded-full overflow-hidden">
                      <div 
                        className={cn("absolute inset-y-0 left-0 rounded-full transition-all", config.progressColor)}
                        style={{ width: `${progressPercent}%` }}
                      />
                      {/* Expected pace marker */}
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-foreground/40"
                        style={{ left: `${Math.min(rep.pacePercentage, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Daily target: {rep.dailyTarget.toFixed(1)} FP+</span>
                      {rep.status === 'ahead' && (
                        <span className="text-emerald-600">+{(rep.currentFp - (rep.willDoGoal * rep.pacePercentage / 100)).toFixed(1)} ahead</span>
                      )}
                      {rep.status === 'behind' && (
                        <span className="text-amber-600">{(rep.currentFp - (rep.willDoGoal * rep.pacePercentage / 100)).toFixed(1)} behind</span>
                      )}
                      {rep.status === 'critical' && (
                        <span className="text-red-600">{(rep.currentFp - (rep.willDoGoal * rep.pacePercentage / 100)).toFixed(1)} behind</span>
                      )}
                    </div>
                  </div>

                  {/* Goal tiers */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                    <div className="flex-1 text-center">
                      <div className="text-xs text-muted-foreground">Must Do</div>
                      <div className="text-sm font-medium">{rep.mustDoGoal}</div>
                    </div>
                    <div className="flex-1 text-center border-x border-border/50">
                      <div className="text-xs text-muted-foreground">Will Do</div>
                      <div className="text-sm font-semibold text-primary">{rep.willDoGoal}</div>
                    </div>
                    <div className="flex-1 text-center">
                      <div className="text-xs text-muted-foreground">Could Do</div>
                      <div className="text-sm font-medium">{rep.couldDoGoal}</div>
                    </div>
                  </div>
                </div>
              );
            })}

            {reps.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No reps have started their summer yet</p>
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
