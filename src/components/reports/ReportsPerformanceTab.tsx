import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Sparkles, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { SalesFunnelChart } from "@/components/insights/SalesFunnelChart";
import { TeamProgressChart } from "./TeamProgressChart";
import { TeamCanceledStatsCard } from "./TeamCanceledStatsCard";
import { TrendingUp, TrendingDown, Target, Clock } from "lucide-react";

interface FunnelData {
  doors: { total: number; conversionToNext: number };
  decisionMakers: { total: number; conversionToNext: number };
  pitches: { total: number; conversionToNext: number };
  transitions: { total: number; conversionToNext: number };
  presentations: { total: number; conversionToNext: number };
  closes: { total: number };
}

interface ReportsPerformanceTabProps {
  insightsData?: {
    totalFP: number;
    totalPRMR: number;
    totalDoors: number;
    totalDMs: number;
    totalPitches: number;
    totalTransitions: number;
    totalPresentations: number;
    totalCloses: number;
    fpCount: number;
    upgradeCount: number;
    avgPrmrPerFp: number;
    avgPrmrPerUpgrade: number;
    doorsToFp: number;
    overallDoorsToFp: number;
    pitchesToFp: number;
    overallPitchesToFp: number;
    transitionsToFp: number;
    overallTransitionsToFp: number;
    presentationsToClose: number;
    overallPresentationsToClose: number;
    doorsPerHour: number;
    pitchesPerHour: number;
    transitionsPerHour: number;
    presentationsPerHour: number;
    hoursToFp: number;
    funnelData?: FunnelData;
  };
  
  teamCumulativeData?: any;
  repBreakdown?: any;
  groupedByTeam?: any;
  groupedByMgmt?: any;
  dailyTrendByRep?: any;
  dailyTrendByTeam?: any;
  dailyTrendByMgmt?: any;
  accessLevel: 'area_director' | 'mgmt_group_lead' | 'team_lead' | 'recruiter' | 'none';
  cumulativeLoading?: boolean;
  
  canceledStats?: any;
  canceledLoading?: boolean;
  canceledTitle?: string;
  
  isLoading?: boolean;
}

const RatioCard = ({ 
  label, 
  value, 
  overall, 
  isLowerBetter = true 
}: { 
  label: string; 
  value: number; 
  overall: number; 
  isLowerBetter?: boolean;
}) => {
  const diff = isLowerBetter ? overall - value : value - overall;
  const percentDiff = overall > 0 ? Math.abs((diff / overall) * 100) : 0;
  const isBetter = diff > 0;

  return (
    <div className="p-3 bg-muted/30 rounded-lg">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {percentDiff > 0 && (
          <div className={cn(
            "flex items-center gap-0.5 text-[10px]",
            isBetter ? "text-green-600 dark:text-green-400" : "text-orange-500"
          )}>
            {isBetter ? <TrendingDown className="w-2.5 h-2.5" /> : <TrendingUp className="w-2.5 h-2.5" />}
            {percentDiff.toFixed(0)}%
          </div>
        )}
      </div>
      <div className="text-xl font-bold">{value.toFixed(1)}</div>
      <div className="text-[10px] text-muted-foreground">vs {overall.toFixed(1)} avg</div>
    </div>
  );
};

const ProductivityCard = ({ label, value }: { label: string; value: number }) => (
  <div className="text-center p-2">
    <div className="text-lg font-bold">{value.toFixed(1)}</div>
    <div className="text-[10px] text-muted-foreground">{label}</div>
  </div>
);

// AI Coach Card - standalone within this tab
const AICoachSection = () => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">AI Coach</h2>
              <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
            </div>
            <ChevronDown className={cn("w-5 h-5 transition-transform text-muted-foreground", isOpen && "rotate-180")} />
          </div>
          {!isOpen && (
            <div className="mt-2 text-left text-sm text-muted-foreground">
              Team coaching insights based on the numbers
            </div>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4">
            <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI Coach will help you understand your team's performance and identify what to work on—no more guessing. 
                Data-driven insights to help your team get better.
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export const ReportsPerformanceTab = ({
  insightsData,
  teamCumulativeData,
  repBreakdown,
  groupedByTeam,
  groupedByMgmt,
  dailyTrendByRep,
  dailyTrendByTeam,
  dailyTrendByMgmt,
  accessLevel,
  cumulativeLoading,
  canceledStats,
  canceledLoading,
  canceledTitle,
  isLoading,
}: ReportsPerformanceTabProps) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-4">
            <div className="h-5 w-32 bg-muted rounded animate-pulse mb-3" />
            <div className="h-24 bg-muted rounded animate-pulse" />
          </Card>
        ))}
      </div>
    );
  }

  if (!insightsData) {
    return (
      <Card className="p-6 text-center">
        <Sparkles className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="font-medium">No performance data</p>
        <p className="text-sm text-muted-foreground">Select a different date range</p>
      </Card>
    );
  }

  const hasCancellations = canceledStats?.totals && 
    (canceledStats.totals.canceledFpCount > 0 || canceledStats.totals.canceledUpgradeCount > 0);

  return (
    <div className="space-y-4">
      {/* AI Coach */}
      <AICoachSection />

      {/* Sales Funnel */}
      {insightsData.funnelData && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Sales Funnel</h3>
          </div>
          <SalesFunnelChart funnelData={insightsData.funnelData} />
        </Card>
      )}

      {/* Key Ratios - Compact Grid */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Key Ratios</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <RatioCard 
            label="Doors → FP" 
            value={insightsData.doorsToFp} 
            overall={insightsData.overallDoorsToFp} 
          />
          <RatioCard 
            label="Pitches → FP" 
            value={insightsData.pitchesToFp} 
            overall={insightsData.overallPitchesToFp} 
          />
          <RatioCard 
            label="Transitions → FP" 
            value={insightsData.transitionsToFp} 
            overall={insightsData.overallTransitionsToFp} 
          />
          <RatioCard 
            label="Pres → Close" 
            value={insightsData.presentationsToClose} 
            overall={insightsData.overallPresentationsToClose} 
          />
        </div>
      </Card>

      {/* Productivity - Compact */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Productivity / Hour</h3>
        </div>
        <div className="grid grid-cols-3 gap-1 bg-muted/30 rounded-lg p-2">
          <ProductivityCard label="Doors/hr" value={insightsData.doorsPerHour} />
          <ProductivityCard label="Pitches/hr" value={insightsData.pitchesPerHour} />
          <ProductivityCard label="Trans/hr" value={insightsData.transitionsPerHour} />
        </div>
        <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-center gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Hours to FP: </span>
            <span className="font-bold">{insightsData.hoursToFp.toFixed(1)}</span>
          </div>
        </div>
      </Card>

      {/* FP Breakdown */}
      {(insightsData.fpCount > 0 || insightsData.upgradeCount > 0) && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">FP+ Breakdown</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-green-500/10 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {insightsData.fpCount}
              </div>
              <div className="text-xs text-muted-foreground">FP</div>
              {insightsData.avgPrmrPerFp > 0 && (
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                  ${Math.round(insightsData.avgPrmrPerFp)} avg
                </div>
              )}
            </div>
            <div className="text-center p-3 bg-blue-500/10 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {insightsData.upgradeCount}
              </div>
              <div className="text-xs text-muted-foreground">Upgrades</div>
              {insightsData.avgPrmrPerUpgrade > 0 && (
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  ${Math.round(insightsData.avgPrmrPerUpgrade)} avg
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Cancellations */}
      {hasCancellations && (
        <TeamCanceledStatsCard
          reps={canceledStats.reps}
          totals={canceledStats.totals}
          isLoading={canceledLoading}
          title={canceledTitle || "Cancellations"}
        />
      )}

      {/* Progress Chart */}
      <TeamProgressChart 
        teamData={teamCumulativeData}
        repBreakdown={repBreakdown}
        groupedByTeam={groupedByTeam}
        groupedByMgmt={groupedByMgmt}
        dailyTrendByRep={dailyTrendByRep}
        dailyTrendByTeam={dailyTrendByTeam}
        dailyTrendByMgmt={dailyTrendByMgmt}
        accessLevel={accessLevel}
        isLoading={cumulativeLoading}
      />
    </div>
  );
};
