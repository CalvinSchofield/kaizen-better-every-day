import { cn } from "@/lib/utils";
import { Target, TrendingUp, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export interface TeamGoalStatus {
  onPace: string[];      // Rep names on pace
  atRisk: string[];      // Rep names at risk
  behind: string[];      // Rep names behind
  noGoals: string[];     // Rep names with no goals configured
}

interface TeamGoalSummaryProps {
  status: TeamGoalStatus;
  className?: string;
}

export const TeamGoalSummary = ({ status, className }: TeamGoalSummaryProps) => {
  const [expandedSection, setExpandedSection] = useState<keyof TeamGoalStatus | null>(null);

  const totalReps = status.onPace.length + status.atRisk.length + status.behind.length + status.noGoals.length;
  
  if (totalReps === 0) {
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
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Team Goal Status</span>
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
  );
};