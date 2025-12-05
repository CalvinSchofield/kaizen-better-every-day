import { Card } from "@/components/ui/card";
import { Trophy, Clock, ChevronDown, Star, Activity, Sparkles, ArrowUpDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { RepDetailDrawer } from "./RepDetailDrawer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RepRankingData } from "@/hooks/useTeamAggregatedRankings";

type SortOption = 
  | 'default' 
  | 'fp' 
  | 'prmr' 
  | 'doors' 
  | 'dms' 
  | 'pitches' 
  | 'transitions' 
  | 'presentations' 
  | 'closes' 
  | 'hours' 
  | 'avgStart' 
  | 'avgEnd'
  | 'fpPerDay'
  | 'doorsPerDay'
  | 'hoursPerDay'
  | 'prmrPerDay'
  | 'pitchesPerDay'
  | 'transitionsPerDay';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'fp', label: 'FP+' },
  { value: 'prmr', label: 'PRMR' },
  { value: 'doors', label: 'Doors' },
  { value: 'dms', label: 'Decision Makers' },
  { value: 'pitches', label: 'Pitches' },
  { value: 'transitions', label: 'Transitions' },
  { value: 'presentations', label: 'Presentations' },
  { value: 'closes', label: 'Closes' },
  { value: 'hours', label: 'Hours Worked' },
  { value: 'avgStart', label: 'Avg Start Time' },
  { value: 'avgEnd', label: 'Avg End Time' },
  { value: 'fpPerDay', label: 'FP+ / Day' },
  { value: 'doorsPerDay', label: 'Doors / Day' },
  { value: 'hoursPerDay', label: 'Hours / Day' },
  { value: 'prmrPerDay', label: 'PRMR / Day' },
  { value: 'pitchesPerDay', label: 'Pitches / Day' },
  { value: 'transitionsPerDay', label: 'Trans / Day' },
];

const formatMinutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`;
};

interface AggregatedRankingsCardProps {
  reps: RepRankingData[];
  totalFP: number;
  totalPRMR: number;
  repCount: number;
  isLoading?: boolean;
  title: string;
}

const formatDuration = (hours: number) => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

export const AggregatedRankingsCard = ({ 
  reps, 
  totalFP, 
  totalPRMR, 
  repCount,
  isLoading, 
  title 
}: AggregatedRankingsCardProps) => {
  const [selectedRep, setSelectedRep] = useState<RepRankingData | null>(null);
  const [repDrawerOpen, setRepDrawerOpen] = useState(false);
  const [outstandingOpen, setOutstandingOpen] = useState(true);
  const [workingOpen, setWorkingOpen] = useState(true);
  const [needsAttentionOpen, setNeedsAttentionOpen] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('default');

  // Helper to get per-day value
  const getPerDay = (value: number, days: number) => days > 0 ? value / days : 0;

  // Sort function
  const sortReps = (repsToSort: RepRankingData[]): RepRankingData[] => {
    if (sortBy === 'default') return repsToSort;
    
    return [...repsToSort].sort((a, b) => {
      switch (sortBy) {
        case 'fp': return b.stats.fp - a.stats.fp;
        case 'prmr': return b.stats.prmr - a.stats.prmr;
        case 'doors': return b.stats.doors - a.stats.doors;
        case 'dms': return b.stats.dms - a.stats.dms;
        case 'pitches': return b.stats.pitches - a.stats.pitches;
        case 'transitions': return b.stats.transitions - a.stats.transitions;
        case 'presentations': return b.stats.presentations - a.stats.presentations;
        case 'closes': return b.stats.closes - a.stats.closes;
        case 'hours': return b.hoursWorked - a.hoursWorked;
        case 'avgStart': 
          if (a.avgStartMinutes === undefined) return 1;
          if (b.avgStartMinutes === undefined) return -1;
          return a.avgStartMinutes - b.avgStartMinutes;
        case 'avgEnd': 
          if (a.avgEndMinutes === undefined) return 1;
          if (b.avgEndMinutes === undefined) return -1;
          return b.avgEndMinutes - a.avgEndMinutes;
        case 'fpPerDay': return getPerDay(b.stats.fp, b.daysWorked) - getPerDay(a.stats.fp, a.daysWorked);
        case 'doorsPerDay': return getPerDay(b.stats.doors, b.daysWorked) - getPerDay(a.stats.doors, a.daysWorked);
        case 'hoursPerDay': return getPerDay(b.hoursWorked, b.daysWorked) - getPerDay(a.hoursWorked, a.daysWorked);
        case 'prmrPerDay': return getPerDay(b.stats.prmr, b.daysWorked) - getPerDay(a.stats.prmr, a.daysWorked);
        case 'pitchesPerDay': return getPerDay(b.stats.pitches, b.daysWorked) - getPerDay(a.stats.pitches, a.daysWorked);
        case 'transitionsPerDay': return getPerDay(b.stats.transitions, b.daysWorked) - getPerDay(a.stats.transitions, a.daysWorked);
        default: return 0;
      }
    });
  };

  // Get display value for current sort metric
  const getSortMetricDisplay = (rep: RepRankingData): string | null => {
    if (sortBy === 'default') return null;
    const perDay = (val: number) => rep.daysWorked > 0 ? val / rep.daysWorked : 0;
    switch (sortBy) {
      case 'fp': return `${rep.stats.fp.toFixed(1)} FP+`;
      case 'prmr': return `$${rep.stats.prmr.toLocaleString()}`;
      case 'doors': return `${rep.stats.doors} doors`;
      case 'dms': return `${rep.stats.dms} DMs`;
      case 'pitches': return `${rep.stats.pitches} pitches`;
      case 'transitions': return `${rep.stats.transitions} trans`;
      case 'presentations': return `${rep.stats.presentations} pres`;
      case 'closes': return `${rep.stats.closes} closes`;
      case 'hours': return formatDuration(rep.hoursWorked);
      case 'avgStart': return rep.avgStartMinutes !== undefined ? formatMinutesToTime(rep.avgStartMinutes) : '—';
      case 'avgEnd': return rep.avgEndMinutes !== undefined ? formatMinutesToTime(rep.avgEndMinutes) : '—';
      case 'fpPerDay': return `${perDay(rep.stats.fp).toFixed(2)} FP+/d`;
      case 'doorsPerDay': return `${perDay(rep.stats.doors).toFixed(1)} doors/d`;
      case 'hoursPerDay': return `${perDay(rep.hoursWorked).toFixed(1)} hrs/d`;
      case 'prmrPerDay': return `$${perDay(rep.stats.prmr).toFixed(0)}/d`;
      case 'pitchesPerDay': return `${perDay(rep.stats.pitches).toFixed(1)} pitch/d`;
      case 'transitionsPerDay': return `${perDay(rep.stats.transitions).toFixed(1)} trans/d`;
      default: return null;
    }
  };

  const handleRepClick = (rep: RepRankingData) => {
    setSelectedRep(rep);
    setRepDrawerOpen(true);
  };

  const getRepDetailData = (rep: RepRankingData) => {
    if (!rep) return null;
    return {
      userId: rep.userId,
      name: rep.name,
      year: rep.year || 'unknown',
      teamName: rep.teamName || 'No Team',
      mgmtGroupName: rep.mgmtGroupName || 'No Group',
      doors: rep.stats.doors,
      dms: rep.stats.dms,
      pitches: rep.stats.pitches,
      transitions: rep.stats.transitions,
      presentations: rep.stats.presentations,
      closes: rep.stats.closes,
      fp: rep.stats.fp,
      upgradeFP: rep.stats.upgradePrmr / 85,
      prmr: rep.stats.prmr,
      upgradePRMR: rep.stats.upgradePrmr,
      doorsToFpRatio: rep.stats.fp > 0 ? rep.stats.doors / rep.stats.fp : 0,
      hoursWorked: rep.hoursWorked,
      daysWorked: rep.daysWorked,
      workStartTime: rep.workStartTime,
    };
  };

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="h-5 w-32 bg-muted rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="h-4 w-12 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  // Categorize reps
  // Outstanding: Has FP+ OR has presentations
  const outstandingBase = reps
    .filter(r => r.stats.fp > 0 || r.stats.presentations > 0);
  
  const outstandingDefaultSorted = outstandingBase.sort((a, b) => {
    if (b.stats.fp !== a.stats.fp) return b.stats.fp - a.stats.fp;
    if (b.stats.prmr !== a.stats.prmr) return b.stats.prmr - a.stats.prmr;
    return b.stats.presentations - a.stats.presentations;
  });

  const outstanding = sortBy === 'default' ? outstandingDefaultSorted : sortReps(outstandingBase);

  // Calculate team average pace as fallback for reps without historical data
  const teamAvgPitchesPerHour = reps.reduce((sum, r) => sum + r.stats.pitches, 0) / Math.max(1, reps.reduce((sum, r) => sum + r.hoursWorked, 0));
  const teamAvgTransitionsPerHour = reps.reduce((sum, r) => sum + r.stats.transitions, 0) / Math.max(1, reps.reduce((sum, r) => sum + r.hoursWorked, 0));

  // Needs Attention: Reps performing below 50% of THEIR OWN historical average
  // Fallback to team average if no historical data, or low door count
  const needsAttentionBase = reps.filter(r => {
    if (r.hoursWorked < 0.5) return false; // Skip if less than 30 min
    if (r.stats.fp > 0 || r.stats.presentations > 0) return false; // Exclude outstanding reps
    
    const pitchesPerHour = r.hoursWorked > 0 ? r.stats.pitches / r.hoursWorked : 0;
    const transitionsPerHour = r.hoursWorked > 0 ? r.stats.transitions / r.hoursWorked : 0;
    
    // Use individual historical averages if available, otherwise fall back to team avg
    const hasHistory = r.historicalAvg && r.historicalAvg.totalHours >= 2; // At least 2 hours of history
    const comparePitchAvg = hasHistory ? r.historicalAvg!.pitchesPerHour : teamAvgPitchesPerHour;
    const compareTransAvg = hasHistory ? r.historicalAvg!.transitionsPerHour : teamAvgTransitionsPerHour;
    
    const isBelowPitchAvg = comparePitchAvg > 0 && pitchesPerHour < comparePitchAvg * 0.5;
    const isBelowTransAvg = compareTransAvg > 0 && transitionsPerHour < compareTransAvg * 0.5;
    
    // Below 50% in BOTH metrics OR low door count fallback (for new reps)
    return (isBelowPitchAvg && isBelowTransAvg) || (r.hoursWorked >= 0.5 && r.stats.doors < 5 && !hasHistory);
  });

  // Add performance percentage for display (vs their own historical avg)
  const needsAttentionWithPct = needsAttentionBase.map(r => {
    const pitchesPerHour = r.hoursWorked > 0 ? r.stats.pitches / r.hoursWorked : 0;
    const transitionsPerHour = r.hoursWorked > 0 ? r.stats.transitions / r.hoursWorked : 0;
    
    const hasHistory = r.historicalAvg && r.historicalAvg.totalHours >= 2;
    const comparePitchAvg = hasHistory ? r.historicalAvg!.pitchesPerHour : teamAvgPitchesPerHour;
    const compareTransAvg = hasHistory ? r.historicalAvg!.transitionsPerHour : teamAvgTransitionsPerHour;
    
    const pitchPct = comparePitchAvg > 0 ? Math.round((pitchesPerHour / comparePitchAvg) * 100) : 0;
    const transPct = compareTransAvg > 0 ? Math.round((transitionsPerHour / compareTransAvg) * 100) : 0;
    
    return { ...r, pitchPct, transPct, hasHistory };
  });

  const needsAttentionDefaultSorted = [...needsAttentionWithPct].sort((a, b) => {
    const aWorst = Math.min(a.pitchPct, a.transPct);
    const bWorst = Math.min(b.pitchPct, b.transPct);
    return aWorst - bWorst; // Worst performers first
  });
  const needsAttention = sortBy === 'default' ? needsAttentionDefaultSorted : sortReps(needsAttentionWithPct as RepRankingData[]);

  // Working: Has activity but no FP+/presentations and not in needs attention
  const outstandingIds = new Set(outstandingBase.map(r => r.userId));
  const needsAttentionIds = new Set(needsAttentionBase.map(r => r.userId));
  const workingBase = reps.filter(r => !outstandingIds.has(r.userId) && !needsAttentionIds.has(r.userId) && r.stats.doors > 0);
  const workingDefaultSorted = [...workingBase].sort((a, b) => b.stats.doors - a.stats.doors);
  const working = sortBy === 'default' ? workingDefaultSorted : sortReps(workingBase);

  if (reps.length === 0) {
    return (
      <Card className="p-4">
        <h3 className="font-semibold mb-4">{title}</h3>
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <p className="font-medium mb-1">No data for this period</p>
          <p className="text-sm text-muted-foreground">
            No finalized entries found for this time range.
          </p>
        </div>
      </Card>
    );
  }

  const RepRow = ({ rep, showRank, rank }: { 
    rep: RepRankingData; 
    showRank?: boolean; 
    rank?: number;
  }) => {
    const hasSales = rep.stats.fp > 0;
    const sortMetric = getSortMetricDisplay(rep);
    
    return (
      <button 
        onClick={() => handleRepClick(rep)}
        className="flex items-center justify-between py-2 px-2 rounded-md text-sm w-full text-left transition-colors hover:bg-muted/50"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {showRank && rank !== undefined && (
            <span className={cn(
              "w-5 flex-shrink-0 text-center text-xs font-medium",
              rank === 0 && "text-primary"
            )}>
              {rank === 0 ? <Trophy className="w-4 h-4" /> : rank + 1}
            </span>
          )}
          <div className="flex flex-col min-w-0">
            <span className="truncate font-medium">
              {rep.name}
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {formatDuration(rep.hoursWorked)}
              {rep.stats.doors > 0 && ` · ${rep.stats.doors} doors`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 text-right">
          {/* Show sort metric when sorting, otherwise show default display */}
          {sortBy !== 'default' && sortMetric ? (
            <span className="font-semibold text-primary tabular-nums">
              {sortMetric}
            </span>
          ) : hasSales ? (
            <>
              <span className="font-semibold text-primary tabular-nums">
                {rep.stats.fp.toFixed(1)} FP+
              </span>
              {rep.stats.prmr > 0 && (
                <span className="font-semibold text-green-700 dark:text-green-500 tabular-nums text-xs">
                  ${rep.stats.prmr.toLocaleString()}
                </span>
              )}
            </>
          ) : rep.stats.presentations > 0 ? (
            <span className="font-medium text-amber-600 dark:text-amber-500 tabular-nums">
              {rep.stats.presentations} pres
            </span>
          ) : (
            <span className="text-muted-foreground tabular-nums text-xs">
              {rep.stats.transitions > 0 ? `${rep.stats.transitions} trans` : 
               rep.stats.pitches > 0 ? `${rep.stats.pitches} pitch` : ''}
            </span>
          )}
        </div>
      </button>
    );
  };

  const SectionHeader = ({ 
    icon: Icon, 
    title, 
    count, 
    color, 
    isOpen, 
    onToggle 
  }: { 
    icon: any; 
    title: string; 
    count: number; 
    color: string; 
    isOpen: boolean; 
    onToggle: () => void;
  }) => (
    <CollapsibleTrigger 
      onClick={onToggle}
      className={cn(
        "flex items-center justify-between w-full py-2 px-3 rounded-lg transition-colors",
        color
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">({count})</span>
      </div>
      <ChevronDown className={cn(
        "w-4 h-4 transition-transform",
        isOpen && "rotate-180"
      )} />
    </CollapsibleTrigger>
  );

  return (
    <>
      <Card className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <h3 className="font-semibold">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="h-7 text-xs w-auto gap-1 border-muted-foreground/20">
                <ArrowUpDown className="w-3 h-3" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Team Totals */}
        {(totalFP > 0 || totalPRMR > 0) && (
          <div className="flex items-center gap-4 mb-4 py-2 px-3 bg-primary/5 rounded-lg text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">FP+:</span>
              <span className="font-bold text-primary">{totalFP.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">PRMR:</span>
              <span className="font-bold text-green-700 dark:text-green-500">${totalPRMR.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Collapsible Sections */}
        <div className="space-y-2">
          {/* Outstanding Performance */}
          {outstanding.length > 0 && (
            <Collapsible open={outstandingOpen} onOpenChange={setOutstandingOpen}>
              <SectionHeader
                icon={Star}
                title="Outstanding"
                count={outstanding.length}
                color="bg-primary/10 hover:bg-primary/15 text-primary"
                isOpen={outstandingOpen}
                onToggle={() => setOutstandingOpen(!outstandingOpen)}
              />
              <CollapsibleContent className="pt-1">
                <div className="space-y-0.5 pl-1">
                  {outstanding.map((rep, idx) => (
                    <RepRow key={rep.userId} rep={rep} showRank rank={idx} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Working */}
          {working.length > 0 && (
            <Collapsible open={workingOpen} onOpenChange={setWorkingOpen}>
              <SectionHeader
                icon={Activity}
                title="Working"
                count={working.length}
                color="bg-blue-500/10 hover:bg-blue-500/15 text-blue-600 dark:text-blue-400"
                isOpen={workingOpen}
                onToggle={() => setWorkingOpen(!workingOpen)}
              />
              <CollapsibleContent className="pt-1">
                <div className="space-y-0.5 pl-1">
                  {working.map((rep) => (
                    <RepRow key={rep.userId} rep={rep} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Needs Attention */}
          {needsAttention.length > 0 && (
            <Collapsible open={needsAttentionOpen} onOpenChange={setNeedsAttentionOpen}>
              <SectionHeader
                icon={AlertTriangle}
                title="Needs Attention"
                count={needsAttention.length}
                color="bg-amber-500/10 hover:bg-amber-500/15 text-amber-600 dark:text-amber-400"
                isOpen={needsAttentionOpen}
                onToggle={() => setNeedsAttentionOpen(!needsAttentionOpen)}
              />
              <CollapsibleContent className="pt-1">
                <div className="space-y-0.5 pl-1">
                  {needsAttention.map((rep: any) => (
                    <button 
                      key={rep.userId}
                      onClick={() => handleRepClick(rep)}
                      className="flex items-center justify-between py-2 px-2 rounded-md text-sm w-full text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-medium">{rep.name}</span>
                        <span className="text-[10px] text-amber-600 dark:text-amber-400">
                          {rep.pitchPct}% pitch · {rep.transPct}% trans
                          <span className="text-muted-foreground ml-1">
                            (vs {rep.hasHistory ? 'own avg' : 'team'})
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 text-right">
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {rep.stats.doors} doors · {formatDuration(rep.hoursWorked)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </Card>

      {/* Rep Detail Drawer */}
      {selectedRep && (
        <RepDetailDrawer
          open={repDrawerOpen}
          onOpenChange={setRepDrawerOpen}
          rep={getRepDetailData(selectedRep)}
        />
      )}
    </>
  );
};
