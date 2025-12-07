import { Card } from "@/components/ui/card";
import { Trophy, Clock, ChevronDown, Star, Activity, Sparkles, ArrowUpDown, AlertTriangle, Info, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { RepDetailDrawer } from "./RepDetailDrawer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RepRankingData } from "@/hooks/useTeamAggregatedRankings";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

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

// Sort options - always use FP+ for reports
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

// Red flag pattern detection
interface RedFlag {
  type: 'low-pitch-rate' | 'not-transitioning' | 'not-closing' | 'timing-issue';
  label: string;
}

const detectRedFlags = (stats: RepRankingData['stats']): RedFlag[] => {
  const flags: RedFlag[] = [];
  
  // Lots of doors, no pitches (doors > 20 AND pitches < doors × 0.1)
  if (stats.doors > 20 && stats.pitches < stats.doors * 0.1) {
    flags.push({ type: 'low-pitch-rate', label: 'Low pitch rate' });
  }
  
  // Pitches but no transitions (pitches > 5 AND transitions < pitches × 0.2)
  if (stats.pitches > 5 && stats.transitions < stats.pitches * 0.2) {
    flags.push({ type: 'not-transitioning', label: 'Not transitioning' });
  }
  
  // Presentations no closes (presentations > 2 AND closes === 0)
  if (stats.presentations > 2 && stats.closes === 0) {
    flags.push({ type: 'not-closing', label: 'Not closing' });
  }
  
  // High doors, no DMs (doors > 30 AND dms < doors × 0.05)
  if (stats.doors > 30 && stats.dms < stats.doors * 0.05) {
    flags.push({ type: 'timing-issue', label: 'Timing issue?' });
  }
  
  return flags;
};

// Helper to get first name from full name
const getFirstName = (name: string) => {
  const stripped = name.replace(/[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}]/gu, '').trim();
  return stripped.split(' ')[0] || stripped;
};

// Generate SMS message based on rep status
const generateSmsMessage = (
  rep: RepRankingData, 
  type: 'outstanding' | 'attention' | 'working'
): string => {
  const firstName = getFirstName(rep.name);
  
  switch (type) {
    case 'outstanding':
      if (rep.stats.fp > 0) {
        return `Hey ${firstName}! Crushing it - ${rep.stats.fp.toFixed(1)} FP+! Keep it up! 🔥`;
      }
      return `Hey ${firstName}! Love the hustle - ${rep.stats.presentations} presentations! Let's close some deals! 💪`;
    case 'attention':
      return `Hey ${firstName}! How's it going out there? Checking in to see how I can help - anything you need?`;
    case 'working':
      return `Hey ${firstName}! Keep pushing - you got this! 💪`;
    default:
      return '';
  }
};

// Open SMS with prefilled message
const openSms = (phone: string, message: string) => {
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  window.open(`sms:${cleanPhone}?body=${encodedMessage}`, '_blank');
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
  const [filterRookiesOnly, setFilterRookiesOnly] = useState(false);

  // Filter reps based on toggle
  const filteredReps = filterRookiesOnly 
    ? reps.filter(r => r.year === 'Rookie') 
    : reps;

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
  const outstandingBase = filteredReps
    .filter(r => r.stats.fp > 0 || r.stats.presentations > 0);
  
  const outstandingDefaultSorted = outstandingBase.sort((a, b) => {
    if (b.stats.fp !== a.stats.fp) return b.stats.fp - a.stats.fp;
    if (b.stats.prmr !== a.stats.prmr) return b.stats.prmr - a.stats.prmr;
    return b.stats.presentations - a.stats.presentations;
  });

  const outstanding = sortBy === 'default' ? outstandingDefaultSorted : sortReps(outstandingBase);

  // Calculate team average pace as fallback for reps without historical data
  const teamAvgPitchesPerHour = filteredReps.reduce((sum, r) => sum + r.stats.pitches, 0) / Math.max(1, filteredReps.reduce((sum, r) => sum + r.hoursWorked, 0));
  const teamAvgTransitionsPerHour = filteredReps.reduce((sum, r) => sum + r.stats.transitions, 0) / Math.max(1, filteredReps.reduce((sum, r) => sum + r.hoursWorked, 0));

  // Needs Attention: Reps performing below 50% of THEIR OWN historical average
  // Fallback to team average if no historical data, or low door count
  const needsAttentionBase = filteredReps.filter(r => {
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
  const workingBase = filteredReps.filter(r => !outstandingIds.has(r.userId) && !needsAttentionIds.has(r.userId) && r.stats.doors > 0);
  const workingDefaultSorted = [...workingBase].sort((a, b) => b.stats.doors - a.stats.doors);
  const working = sortBy === 'default' ? workingDefaultSorted : sortReps(workingBase);

  // Recalculate totals based on filtered reps
  const displayTotalFP = filteredReps.reduce((sum, r) => sum + r.stats.fp, 0);
  const displayTotalPRMR = filteredReps.reduce((sum, r) => sum + r.stats.prmr, 0);

  if (filteredReps.length === 0) {
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

  const RepRow = ({ rep, showRank, rank, smsType }: { 
    rep: RepRankingData; 
    showRank?: boolean; 
    rank?: number;
    smsType?: 'outstanding' | 'attention' | 'working';
  }) => {
    const hasSales = rep.stats.fp > 0;
    const sortMetric = getSortMetricDisplay(rep);
    const redFlags = detectRedFlags(rep.stats);
    
    const handleTextClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!rep.phone) {
        toast.error("No phone number available");
        return;
      }
      const message = generateSmsMessage(rep, smsType || 'working');
      openSms(rep.phone, message);
    };
    
    return (
      <div className="flex items-center gap-1">
        <button 
          onClick={() => handleRepClick(rep)}
          className="flex items-center justify-between py-2 px-2 rounded-md text-sm flex-1 text-left transition-colors hover:bg-muted/50"
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
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium">
                  {rep.name}
                </span>
                {rep.hasUnfinalizedEntry && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" title="Has unsaved entry" />
                )}
                {/* Red flag badges */}
                {redFlags.length > 0 && (
                  <div className="flex items-center gap-1">
                    {redFlags.slice(0, 1).map((flag, i) => (
                      <span 
                        key={i}
                        className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 whitespace-nowrap"
                      >
                        {flag.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
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
        
        {/* Text button */}
        {rep.phone && (
          <button
            onClick={handleTextClick}
            className={cn(
              "p-1.5 rounded-md transition-colors flex-shrink-0",
              smsType === 'outstanding' 
                ? "text-primary hover:bg-primary/10" 
                : smsType === 'attention'
                ? "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                : "text-muted-foreground hover:bg-muted"
            )}
            title="Send text"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        )}
      </div>
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[280px] text-xs">
                  <p className="font-medium mb-1">How comparisons work:</p>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Rookies</span> are compared to their rolling 2-week average due to steep learning curves.
                  </p>
                  <p className="text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">Vets</span> are compared to their season average (summer vs summer, preseason vs preseason).
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-2">
            {/* All vs Rookies Only toggle */}
            <button
              onClick={() => setFilterRookiesOnly(!filterRookiesOnly)}
              className={cn(
                "h-7 px-3 text-xs rounded-full border transition-colors",
                filterRookiesOnly 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : "bg-background border-muted-foreground/20 hover:bg-muted"
              )}
            >
              {filterRookiesOnly ? "Rookies" : "All"}
            </button>
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
        {(displayTotalFP > 0 || displayTotalPRMR > 0) && (
          <div className="flex items-center gap-4 mb-4 py-2 px-3 bg-primary/5 rounded-lg text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">FP+:</span>
              <span className="font-bold text-primary">{displayTotalFP.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">PRMR:</span>
              <span className="font-bold text-green-700 dark:text-green-500">${displayTotalPRMR.toLocaleString()}</span>
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
                    <RepRow key={rep.userId} rep={rep} showRank rank={idx} smsType="outstanding" />
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
                    <RepRow key={rep.userId} rep={rep} smsType="working" />
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
                    <RepRow key={rep.userId} rep={rep} smsType="attention" />
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
