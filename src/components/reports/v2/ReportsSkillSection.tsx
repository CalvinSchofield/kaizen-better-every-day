import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, TrendingUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FunnelStage } from "@/utils/constraintAnalysis";

interface ReportsSkillSectionProps {
  // The single biggest bottleneck to focus on
  bottleneck: FunnelStage | null;
  
  // Impact statement
  impactPotential?: string | null;
  
  // Full funnel data for optional expanded view
  funnelData?: {
    doors: number;
    decisionMakers: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
  };
  
  isLoading?: boolean;
}

export const ReportsSkillSection = ({
  bottleneck,
  impactPotential,
  funnelData,
  isLoading,
}: ReportsSkillSectionProps) => {
  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="h-6 w-32 bg-muted animate-pulse rounded mb-4" />
        <div className="h-20 bg-muted animate-pulse rounded" />
      </Card>
    );
  }

  // If no bottleneck, skill is strong
  if (!bottleneck) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-green-500" />
          <h3 className="font-semibold text-lg">Skill</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          All funnel conversions are within expected ranges. No training gaps detected.
        </p>
      </Card>
    );
  }

  const actualPercent = (bottleneck.rate * 100).toFixed(0);
  const benchmarkPercent = (bottleneck.benchmark * 100).toFixed(0);
  const gap = ((bottleneck.benchmark - bottleneck.rate) * 100).toFixed(0);
  const severity = bottleneck.rate < bottleneck.benchmark * 0.7 ? 'critical' : 'warning';

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className={cn(
          "w-5 h-5",
          severity === 'critical' ? "text-destructive" : "text-yellow-500"
        )} />
        <h3 className="font-semibold text-lg">Skill Gap Identified</h3>
      </div>

      {/* Bottleneck highlight */}
      <div className={cn(
        "p-4 rounded-lg border-l-4 mb-4",
        severity === 'critical' 
          ? "bg-destructive/10 border-destructive" 
          : "bg-yellow-500/10 border-yellow-500"
      )}>
        <div className="flex items-center gap-3 mb-2">
          <Badge variant="outline" className="font-medium">
            {bottleneck.fromLabel}
          </Badge>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <Badge variant="outline" className="font-medium">
            {bottleneck.toLabel}
          </Badge>
        </div>
        
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{actualPercent}%</span>
          <span className="text-muted-foreground">
            vs {benchmarkPercent}% benchmark
          </span>
          <Badge variant={severity === 'critical' ? 'destructive' : 'secondary'} className="ml-2">
            -{gap}%
          </Badge>
        </div>

        {/* Training focus */}
        <p className="text-sm mt-2">
          <span className="font-medium">Training focus:</span>{' '}
          {getTrainingRecommendation(bottleneck.name)}
        </p>
      </div>

      {/* Impact potential */}
      {impactPotential && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <TrendingUp className="w-4 h-4" />
          <span>{impactPotential}</span>
        </div>
      )}

      {/* Optional mini funnel */}
      {funnelData && (
        <div className="mt-4 pt-4 border-t border-border/50">
          <MiniWorkflow data={funnelData} bottleneckStage={bottleneck.name} />
        </div>
      )}
    </Card>
  );
};

// Training recommendations based on bottleneck stage
const getTrainingRecommendation = (stage: string): string => {
  switch (stage) {
    case 'doors_to_dms':
      return 'Work on door approach and getting homeowners to the door';
    case 'dms_to_pitches':
      return 'Practice opening lines and building initial rapport';
    case 'pitches_to_transitions':
      return 'Focus on pitch framing and creating curiosity';
    case 'transitions_to_presentations':
      return 'Work on getting inside and setting up presentations';
    case 'presentations_to_closes':
      return 'Practice closing techniques and handling objections';
    default:
      return 'Review overall sales process';
  }
};

// Mini horizontal workflow showing funnel
const MiniWorkflow = ({
  data,
  bottleneckStage,
}: {
  data: {
    doors: number;
    decisionMakers: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
  };
  bottleneckStage: string;
}) => {
  const stages = [
    { key: 'doors_to_dms', from: 'Doors', value: data.doors },
    { key: 'dms_to_pitches', from: 'DMs', value: data.decisionMakers },
    { key: 'pitches_to_transitions', from: 'Pitches', value: data.pitches },
    { key: 'transitions_to_presentations', from: 'Trans', value: data.transitions },
    { key: 'presentations_to_closes', from: 'Pres', value: data.presentations },
    { key: 'closes', from: 'Closes', value: data.closes },
  ];

  return (
    <div className="flex items-center justify-between overflow-x-auto pb-2">
      {stages.map((stage, idx) => (
        <div key={stage.key} className="flex items-center">
          <div className={cn(
            "text-center px-2",
            bottleneckStage === stage.key && "text-destructive font-medium"
          )}>
            <div className="text-lg font-semibold tabular-nums">{stage.value}</div>
            <div className="text-xs text-muted-foreground">{stage.from}</div>
          </div>
          {idx < stages.length - 1 && (
            <ArrowRight className={cn(
              "w-3 h-3 mx-1 flex-shrink-0",
              bottleneckStage === stage.key ? "text-destructive" : "text-muted-foreground/50"
            )} />
          )}
        </div>
      ))}
    </div>
  );
};
