import { cn } from "@/lib/utils";
import { Target, TrendingUp, AlertTriangle, XCircle, HelpCircle, Users, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { TeamBaseline } from "@/utils/baselineCalculations";

export interface TeamGoalStatus {
  onPace: string[];      // Rep names on pace
  atRisk: string[];      // Rep names at risk
  behind: string[];      // Rep names behind
  noGoals: string[];     // Rep names with no goals configured
}

interface TeamGoalSummaryProps {
  status: TeamGoalStatus;
  baseline?: TeamBaseline;
  className?: string;
}

export const TeamGoalSummary = ({ status, baseline, className }: TeamGoalSummaryProps) => {
  const [expandedSection, setExpandedSection] = useState<keyof TeamGoalStatus | null>(null);
  const [showBaselineDetails, setShowBaselineDetails] = useState(false);

  const totalReps = status.onPace.length + status.atRisk.length + status.behind.length + status.noGoals.length;
  
  if (totalReps === 0 && !baseline) {
    return null;
  }

  const getFirstName = (name: string) => name.split(' ')[0];

  const sections = [
    {
      key: 'onPace' as const,
      label: 'On Pace',
      count: status.onPace.length,
      names: status.onPace,
      icon: <TrendingUp className="w-3 h-3" />,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-500/10 border-green-500/30',
    },
    {
      key: 'atRisk' as const,
      label: 'At Risk',
      count: status.atRisk.length,
      names: status.atRisk,
      icon: <AlertTriangle className="w-3 h-3" />,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-500/10 border-yellow-500/30',
    },
    {
      key: 'behind' as const,
      label: 'Behind',
      count: status.behind.length,
      names: status.behind,
      icon: <XCircle className="w-3 h-3" />,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-500/10 border-red-500/30',
    },
    {
      key: 'noGoals' as const,
      label: 'No Goals',
      count: status.noGoals.length,
      names: status.noGoals,
      icon: <HelpCircle className="w-3 h-3" />,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/50 border-muted',
    },
  ].filter(s => s.count > 0);

  const toggleSection = (key: keyof TeamGoalStatus) => {
    setExpandedSection(expandedSection === key ? null : key);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Goal Pace Section */}
      {sections.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Goal Pace</span>
          </div>

          {/* Compact badge row */}
          <div className="flex flex-wrap gap-2">
            {sections.map(section => (
              <Badge
                key={section.key}
                variant="outline"
                className={cn(
                  "gap-1.5 cursor-pointer transition-all",
                  section.color,
                  section.bgColor,
                  expandedSection === section.key && "ring-1 ring-offset-1"
                )}
                onClick={() => toggleSection(section.key)}
              >
                {section.icon}
                <span className="font-medium">{section.count}</span>
                <span className="opacity-70">{section.label}</span>
              </Badge>
            ))}
          </div>

          {/* Expanded name list */}
          {expandedSection && (
            <div className="p-2 rounded-lg bg-muted/30 text-sm">
              <div className="flex flex-wrap gap-1">
                {sections.find(s => s.key === expandedSection)?.names.map((name, idx) => (
                  <span key={idx} className="text-muted-foreground">
                    {getFirstName(name)}
                    {idx < (sections.find(s => s.key === expandedSection)?.names.length ?? 0) - 1 && ','}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Team Baseline Section */}
      {baseline && baseline.workingTodayCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Team Baseline</span>
            <span className="text-xs text-muted-foreground">
              ({baseline.workingTodayCount} working)
            </span>
          </div>

          <div 
            className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 cursor-pointer"
            onClick={() => setShowBaselineDetails(!showBaselineDetails)}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  Expected: {baseline.teamExpectedFPToday.toFixed(1)} FP+ today
                </span>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Based on 2-week rolling averages
                </p>
              </div>
              <ChevronDown className={cn(
                "w-4 h-4 text-muted-foreground transition-transform",
                showBaselineDetails && "rotate-180"
              )} />
            </div>

            {showBaselineDetails && (
              <div className="mt-2 pt-2 border-t border-blue-500/20 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">This week</span>
                  <span className="font-medium">~{baseline.teamExpectedFPThisWeek.toFixed(0)} FP+</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">This month</span>
                  <span className="font-medium">~{baseline.teamExpectedFPThisMonth.toFixed(0)} FP+</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Avg per rep</span>
                  <span className="font-medium">{baseline.avgFPPerWorkingRep.toFixed(1)} FP+/day</span>
                </div>
                {baseline.workingTodayNames.length > 0 && (
                  <div className="pt-1 mt-1 border-t border-blue-500/10">
                    <span className="text-[10px] text-muted-foreground">
                      Working: {baseline.workingTodayNames.map(getFirstName).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
