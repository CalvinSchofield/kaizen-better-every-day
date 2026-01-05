import { Card } from "@/components/ui/card";
import { Crown, Users } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { RepRankingData } from "@/hooks/useTeamAggregatedRankings";
import { getFirstName } from "@/components/mygroup/recruit-detail/utils";

interface RookieCohortCardProps {
  reps: RepRankingData[];
  onRepClick?: (rep: RepRankingData) => void;
}

export const RookieCohortCard = ({ reps, onRepClick }: RookieCohortCardProps) => {
  const [isOpen, setIsOpen] = useState(true);
  
  // Filter to rookies only
  const rookies = reps.filter(r => r.year === 'Rookie');
  
  if (rookies.length < 2) return null;
  
  // Calculate metrics and sort by FP+/day
  const rookiesWithMetrics = rookies.map(r => ({
    ...r,
    fpPerDay: r.daysWorked > 0 ? r.stats.fp / r.daysWorked : 0,
    doorsPerFp: r.stats.fp > 0 ? r.stats.doors / r.stats.fp : r.stats.doors,
  })).sort((a, b) => b.fpPerDay - a.fpPerDay);
  
  const leader = rookiesWithMetrics[0];
  const second = rookiesWithMetrics[1];
  const gap = leader && second ? (leader.fpPerDay - second.fpPerDay).toFixed(2) : '0';
  
  // Calculate averages for comparison
  const avgFpPerDay = rookiesWithMetrics.reduce((sum, r) => sum + r.fpPerDay, 0) / rookiesWithMetrics.length;
  
  return (
    <Card className="p-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Rookie Comparison</h3>
            <span className="text-xs text-muted-foreground">({rookies.length} rookies)</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {isOpen ? 'Hide' : 'Show'}
          </span>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-3 space-y-3">
          {/* Leader highlight */}
          {leader && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" />
                <span className="font-medium text-sm">{leader.name}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-primary">{leader.fpPerDay.toFixed(2)} FP+/day</span>
                {Number(gap) > 0 && (
                  <p className="text-[10px] text-muted-foreground">Leading by {gap} FP+/day</p>
                )}
              </div>
            </div>
          )}
          
          {/* Rookie table */}
          <div className="space-y-1">
            <div className="grid grid-cols-5 text-[10px] text-muted-foreground px-2 pb-1 border-b">
              <span>Name</span>
              <span className="text-center">Days</span>
              <span className="text-center">FP+</span>
              <span className="text-center">FP+/Day</span>
              <span className="text-center">Doors/FP</span>
            </div>
            
            {rookiesWithMetrics.map((r, idx) => (
              <button
                key={r.userId}
                onClick={() => onRepClick?.(r)}
                className={cn(
                  "grid grid-cols-5 text-xs py-1.5 px-2 rounded w-full text-left transition-colors hover:bg-muted/50",
                  idx === 0 && "bg-primary/5"
                )}
              >
                <span className="truncate font-medium flex items-center gap-1">
                  {idx === 0 && <Crown className="w-3 h-3 text-amber-500" />}
                  {getFirstName(r.name)}
                </span>
                <span className="text-center text-muted-foreground">{r.daysWorked}</span>
                <span className="text-center">{r.stats.fp.toFixed(1)}</span>
                <span className={cn(
                  "text-center font-medium",
                  r.fpPerDay >= avgFpPerDay ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                )}>
                  {r.fpPerDay.toFixed(2)}
                </span>
                <span className="text-center text-muted-foreground">
                  {r.doorsPerFp.toFixed(0)}
                </span>
              </button>
            ))}
          </div>
          
          <p className="text-[10px] text-muted-foreground text-center pt-1">
            Avg FP+/Day: {avgFpPerDay.toFixed(2)} • Lower Doors/FP = more efficient
          </p>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
