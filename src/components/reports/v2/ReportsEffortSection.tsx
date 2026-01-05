import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Clock, Footprints } from "lucide-react";
import { cn } from "@/lib/utils";
import { EffortResult, EffortFlag, TeamEffortSummary } from "@/utils/effortScore";
import { EffortThresholdSettings } from "./EffortThresholdSettings";

interface RepWithEffort {
  userId: string;
  name: string;
  year?: string;
  doors: number;
  hoursWorked: number;
  fp: number;
  effort: EffortResult;
}

interface ReportsEffortSectionProps {
  reps: RepWithEffort[];
  summary: TeamEffortSummary;
  onRepClick?: (userId: string) => void;
  isLoading?: boolean;
  teamId?: string;
  mgmtGroupId?: string;
}

export const ReportsEffortSection = ({
  reps,
  summary,
  onRepClick,
  isLoading,
  teamId,
  mgmtGroupId,
}: ReportsEffortSectionProps) => {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    outstanding: false,
    standard: false,
    needs_improvement: true, // Auto-expand the section that needs attention
  });

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="h-6 w-40 bg-muted animate-pulse rounded mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </Card>
    );
  }

  // Group reps by effort category
  const outstanding = reps.filter(r => r.effort.category === 'outstanding');
  const standard = reps.filter(r => r.effort.category === 'standard');
  const needsImprovement = reps.filter(r => r.effort.category === 'needs_improvement');

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const getFirstName = (name: string) => name.split(' ')[0];

  const getFlagIcon = (type: EffortFlag['type']) => {
    switch (type) {
      case 'late_start':
      case 'early_end':
        return <Clock className="w-3 h-3" />;
      case 'low_doors':
      case 'volume_dropping':
        return <Footprints className="w-3 h-3" />;
      default:
        return <AlertTriangle className="w-3 h-3" />;
    }
  };

  const RepRow = ({ rep }: { rep: RepWithEffort }) => (
    <button
      onClick={() => onRepClick?.(rep.userId)}
      className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
    >
      <div className="flex items-center gap-3">
        {/* Effort indicator */}
        <div className={cn(
          "w-2 h-8 rounded-full",
          rep.effort.category === 'outstanding' && "bg-green-500",
          rep.effort.category === 'standard' && "bg-yellow-500",
          rep.effort.category === 'needs_improvement' && "bg-red-500",
        )} />
        
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{getFirstName(rep.name)}</span>
            {rep.year === 'Rookie' && (
              <Badge variant="outline" className="text-xs py-0 px-1">R</Badge>
            )}
          </div>
          
          {/* Flags */}
          {rep.effort.flags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {rep.effort.flags.slice(0, 2).map((flag, idx) => (
                <span
                  key={idx}
                  className={cn(
                    "inline-flex items-center gap-1 text-xs",
                    flag.severity === 'critical' ? "text-destructive" : "text-yellow-600 dark:text-yellow-400"
                  )}
                >
                  {getFlagIcon(flag.type)}
                  {flag.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="text-right">
        <div className="font-semibold tabular-nums">{rep.doors}</div>
        <div className="text-xs text-muted-foreground">
          {rep.effort.doorsPerHour.toFixed(1)}/hr
        </div>
      </div>
    </button>
  );

  const CategorySection = ({
    title,
    category,
    reps,
    icon,
    color,
  }: {
    title: string;
    category: string;
    reps: RepWithEffort[];
    icon: React.ReactNode;
    color: string;
  }) => {
    if (reps.length === 0) return null;

    return (
      <Collapsible
        open={expandedCategories[category]}
        onOpenChange={() => toggleCategory(category)}
      >
        <CollapsibleTrigger className="w-full">
          <div className={cn(
            "flex items-center justify-between p-3 rounded-lg",
            "hover:bg-muted/50 transition-colors",
            color
          )}>
            <div className="flex items-center gap-2">
              {icon}
              <span className="font-medium">{title}</span>
              <Badge variant="secondary" className="ml-1">{reps.length}</Badge>
            </div>
            {expandedCategories[category] ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-1 mt-1 ml-2">
            {reps
              .sort((a, b) => a.effort.score - b.effort.score) // Worst first
              .map(rep => (
                <RepRow key={rep.userId} rep={rep} />
              ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <Card className="p-4">
      {/* Header with summary */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg">Effort</h3>
          <p className="text-sm text-muted-foreground">
            {summary.avgDoorsPerHour.toFixed(1)} doors/hr average
          </p>
        </div>
        
        {/* Quick summary badges + settings */}
        <div className="flex items-center gap-2">
          {summary.outstandingCount > 0 && (
            <Badge variant="outline" className="border-green-500/50 text-green-600 dark:text-green-400">
              {summary.outstandingCount} ⭐
            </Badge>
          )}
          {summary.needsImprovementCount > 0 && (
            <Badge variant="outline" className="border-destructive/50 text-destructive">
              {summary.needsImprovementCount} ⚠️
            </Badge>
          )}
          {(teamId || mgmtGroupId) && (
            <EffortThresholdSettings teamId={teamId} mgmtGroupId={mgmtGroupId} />
          )}
        </div>
      </div>

      {/* Category sections */}
      <div className="space-y-2">
        <CategorySection
          title="Needs Improvement"
          category="needs_improvement"
          reps={needsImprovement}
          icon={<AlertTriangle className="w-4 h-4 text-destructive" />}
          color=""
        />
        
        <CategorySection
          title="Standard"
          category="standard"
          reps={standard}
          icon={<Clock className="w-4 h-4 text-yellow-500" />}
          color=""
        />
        
        <CategorySection
          title="Outstanding"
          category="outstanding"
          reps={outstanding}
          icon={<CheckCircle2 className="w-4 h-4 text-green-500" />}
          color=""
        />
      </div>

      {/* Empty state */}
      {reps.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No activity data for this period
        </div>
      )}
    </Card>
  );
};
