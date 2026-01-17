import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, AlertTriangle, XCircle, HelpCircle, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFP } from "@/lib/formatters";
import { getFirstName } from "@/components/mygroup/recruit-detail/utils";
import { getInitials } from "@/utils/nameUtils";
import { GoalPaceResult } from "@/utils/goalPaceCalculations";

interface GoalPaceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paceResults: GoalPaceResult[];
  periodLabel: string;
  isLiveView?: boolean;
  onRepClick?: (userId: string) => void;
}

type FilterStatus = 'all' | 'on_pace' | 'at_risk' | 'behind' | 'no_goals';

const STATUS_CONFIG = {
  on_pace: {
    label: 'On Pace',
    icon: TrendingUp,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
  at_risk: {
    label: 'At Risk',
    icon: AlertTriangle,
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
  },
  behind: {
    label: 'Behind',
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
  no_goals: {
    label: 'No Goals',
    icon: HelpCircle,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    borderColor: 'border-muted',
  },
};

const TIER_CONFIG = {
  preseason: { label: 'Preseason', color: 'border-blue-400 text-blue-600' },
  mustDo: { label: 'Must Do', color: 'border-red-400 text-red-600' },
  willDo: { label: 'Will Do', color: 'border-primary text-primary' },
  couldDo: { label: 'Could Do', color: 'border-green-400 text-green-600' },
};

export const GoalPaceDrawer = ({
  open,
  onOpenChange,
  paceResults,
  periodLabel,
  isLiveView,
  onRepClick,
}: GoalPaceDrawerProps) => {
  const [filter, setFilter] = useState<FilterStatus>('all');
  
  // Count by status
  const counts = {
    on_pace: paceResults.filter(r => r.status === 'on_pace').length,
    at_risk: paceResults.filter(r => r.status === 'at_risk').length,
    behind: paceResults.filter(r => r.status === 'behind').length,
    no_goals: paceResults.filter(r => r.status === 'no_goals').length,
  };
  
  // Filter results
  const filteredResults = filter === 'all' 
    ? paceResults
    : paceResults.filter(r => r.status === filter);
  
  // Sort: behind first (most urgent), then at_risk, then on_pace, then no_goals
  const sortedResults = [...filteredResults].sort((a, b) => {
    const statusOrder = { behind: 0, at_risk: 1, on_pace: 2, no_goals: 3 };
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    // Within same status, sort by percent (lowest first for urgency)
    return a.percentOfExpected - b.percentOfExpected;
  });

  // Group by tier for display
  const tierGroups = sortedResults.reduce((acc, result) => {
    const tier = result.focusTier || 'no_goals';
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(result);
    return acc;
  }, {} as Record<string, GoalPaceResult[]>);

  const RepCard = ({ result }: { result: GoalPaceResult }) => {
    const config = STATUS_CONFIG[result.status];
    const StatusIcon = config.icon;
    const tierConfig = result.focusTier ? TIER_CONFIG[result.focusTier] : null;
    const progressPercent = Math.min(100, result.percentOfExpected);
    
    return (
      <div 
        className={cn(
          "p-3 rounded-lg border cursor-pointer",
          "hover:bg-muted/30 active:scale-[0.98] transition-all",
          config.bgColor, config.borderColor
        )}
        onClick={() => onRepClick?.(result.userId)}
      >
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {getInitials(result.name)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{getFirstName(result.name)}</span>
              {tierConfig && (
                <Badge 
                  variant="outline" 
                  className={cn("text-[10px] px-1.5 py-0", tierConfig.color)}
                >
                  {tierConfig.label}
                </Badge>
              )}
            </div>
            
            {result.activeGoal > 0 && (
              <div className="mt-1.5">
                <div className="flex justify-between text-xs mb-1">
                  <span className={config.color}>
                    {formatFP(result.currentProgress)} / {formatFP(result.activeGoal)}
                  </span>
                  <span className={cn("font-medium", config.color)}>
                    {Math.round(result.percentOfExpected)}%
                  </span>
                </div>
                <Progress 
                  value={progressPercent} 
                  className="h-1.5"
                />
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <StatusIcon className={cn("w-4 h-4", config.color)} />
            <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Goal Pace • {periodLabel}
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="px-4 pb-6 overflow-y-auto space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-2">
            {(['on_pace', 'at_risk', 'behind', 'no_goals'] as const).map(status => {
              const config = STATUS_CONFIG[status];
              const StatusIcon = config.icon;
              const isActive = filter === status;
              
              return (
                <button
                  key={status}
                  onClick={() => setFilter(filter === status ? 'all' : status)}
                  className={cn(
                    "rounded-lg p-2.5 text-center transition-all",
                    config.bgColor,
                    isActive && "ring-2 ring-offset-2 ring-primary"
                  )}
                >
                  <StatusIcon className={cn("w-4 h-4 mx-auto mb-1", config.color)} />
                  <div className={cn("text-lg font-bold", config.color)}>
                    {counts[status]}
                  </div>
                  <div className="text-[9px] text-muted-foreground truncate">
                    {config.label}
                  </div>
                </button>
              );
            })}
          </div>
          
          {/* Filter indicator */}
          {filter !== 'all' && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Showing {STATUS_CONFIG[filter].label} only
              </span>
              <button 
                onClick={() => setFilter('all')}
                className="text-xs text-primary hover:underline"
              >
                Show all
              </button>
            </div>
          )}
          
          {/* Rep List - grouped by tier when not filtered */}
          <div className="space-y-4">
            {filter === 'all' && Object.keys(tierGroups).length > 1 ? (
              // Show grouped by tier
              Object.entries(tierGroups).map(([tier, results]) => {
                const tierConfig = tier !== 'no_goals' 
                  ? TIER_CONFIG[tier as keyof typeof TIER_CONFIG] 
                  : null;
                
                return (
                  <div key={tier} className="space-y-2">
                    {tierConfig && (
                      <div className={cn(
                        "flex items-center gap-2 text-sm font-medium border-l-2 pl-2",
                        tierConfig.color
                      )}>
                        <Calendar className="w-3.5 h-3.5" />
                        {tierConfig.label} Goal
                        <Badge variant="outline" className="ml-auto text-[10px]">
                          {results.length}
                        </Badge>
                      </div>
                    )}
                    {tier === 'no_goals' && (
                      <div className="text-sm font-medium text-muted-foreground">
                        No Goals Set ({results.length})
                      </div>
                    )}
                    <div className="space-y-2">
                      {results.map(result => (
                        <RepCard key={result.userId} result={result} />
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              // Show flat list
              <div className="space-y-2">
                {sortedResults.map(result => (
                  <RepCard key={result.userId} result={result} />
                ))}
              </div>
            )}
          </div>
          
          {/* Empty State */}
          {sortedResults.length === 0 && (
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
