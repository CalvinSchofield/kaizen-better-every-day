import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Clock, ChevronDown, Star, Activity, AlertTriangle, Sparkles, AlertCircle, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RepDetailDrawer } from "./RepDetailDrawer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import { toast } from "sonner";

interface LiveRepData {
  userId: string;
  name: string;
  teamName: string;
  mgmtGroupName?: string;
  year?: string;
  phone?: string;
  isWorking?: boolean;
  hasForgottenEntry?: boolean;
  forgottenDate?: string;
  todayStats: {
    doors: number;
    dms: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp: number;
    prmr: number;
    upgradePrmr?: number;
    isFinalized?: boolean;
  };
  avgPitchesPerHour?: number;
  avgTransitionsPerHour?: number;
  avgDoorsPerHour?: number;
  workStartTime?: string;
  workEndTime?: string;
  breakMinutes?: number;
  durationMinutes?: number;
  // Timeline data
  entryId?: string;
  counterTimestamps?: Record<string, string[]>;
  salesLog?: Array<{ type: string; prmr: number; timestamp?: string }>;
}

// Helper to get first name from full name
const getFirstName = (name: string) => {
  const stripped = name.replace(/[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}]/gu, '').trim();
  return stripped.split(' ')[0] || stripped;
};

// Generate SMS message based on rep status
const generateSmsMessage = (
  rep: LiveRepData, 
  type: 'outstanding' | 'attention' | 'forgotten'
): string => {
  const firstName = getFirstName(rep.name);
  
  switch (type) {
    case 'outstanding':
      if (rep.todayStats.fp > 0) {
        return `Hey ${firstName}! Crushing it today - ${rep.todayStats.fp.toFixed(1)} FP+ and counting! Keep it up! 🔥`;
      }
      return `Hey ${firstName}! Love the hustle today - ${rep.todayStats.presentations} presentations! Let's close some deals! 💪`;
    case 'attention':
      return `Hey ${firstName}! How's it going out there? Checking in to see how I can help - anything you need?`;
    case 'forgotten':
      const dateStr = rep.forgottenDate ? format(new Date(rep.forgottenDate + 'T12:00:00'), 'MMM d') : 'recently';
      return `Hey ${firstName}! Don't forget to save your entry from ${dateStr}! 📋`;
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

// Open group SMS
const openGroupSms = (phones: string[], message: string) => {
  const cleanPhones = phones.map(p => p.replace(/\D/g, '')).filter(Boolean);
  if (cleanPhones.length === 0) {
    toast.error("No valid phone numbers");
    return;
  }
  const encodedMessage = encodeURIComponent(message);
  // iOS uses comma, Android uses semicolon - using comma for broader support
  const phoneList = cleanPhones.join(',');
  window.open(`sms:${phoneList}?body=${encodedMessage}`, '_blank');
};

interface LiveLeaderboardProps {
  liveReps: LiveRepData[];
  isLoading?: boolean;
  hasWorkingReps?: boolean;
  title?: string;
  workingCount?: number;
  forgottenCount?: number;
}

// Red flag pattern detection
interface RedFlag {
  type: 'low-pitch-rate' | 'not-transitioning' | 'not-closing' | 'timing-issue';
  label: string;
}

const detectRedFlags = (stats: LiveRepData['todayStats']): RedFlag[] => {
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

const stripEmojis = (text: string) => {
  return text.replace(/[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}]/gu, '').trim();
};

const formatTime = (timestamp: string | undefined) => {
  if (!timestamp) return null;
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return null;
  }
};

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

export const LiveLeaderboard = ({ 
  liveReps, 
  isLoading, 
  hasWorkingReps = true, 
  title = "Team Activity",
  workingCount,
  forgottenCount 
}: LiveLeaderboardProps) => {
  const navigate = useNavigate();
  const [selectedRep, setSelectedRep] = useState<LiveRepData | null>(null);
  const [repDrawerOpen, setRepDrawerOpen] = useState(false);
  const [outstandingOpen, setOutstandingOpen] = useState(true);
  const [workingOpen, setWorkingOpen] = useState(true);
  const [attentionOpen, setAttentionOpen] = useState(true);
  const [forgottenOpen, setForgottenOpen] = useState(true);

  const handleRepClick = (rep: LiveRepData) => {
    setSelectedRep(rep);
    setRepDrawerOpen(true);
  };

  const getRepDetailData = (rep: LiveRepData & { durationMinutes?: number }) => {
    if (!rep) return null;
    return {
      userId: rep.userId,
      name: rep.name,
      year: rep.year || 'unknown',
      teamName: rep.teamName || 'No Team',
      mgmtGroupName: rep.mgmtGroupName || 'No Group',
      doors: rep.todayStats.doors,
      dms: rep.todayStats.dms,
      pitches: rep.todayStats.pitches,
      transitions: rep.todayStats.transitions,
      presentations: rep.todayStats.presentations,
      closes: rep.todayStats.closes,
      fp: rep.todayStats.fp,
      upgradeFP: (rep.todayStats.upgradePrmr || 0) / 85,
      prmr: rep.todayStats.prmr,
      upgradePRMR: rep.todayStats.upgradePrmr || 0,
      doorsToFpRatio: rep.todayStats.fp > 0 ? rep.todayStats.doors / rep.todayStats.fp : 0,
      hoursWorked: (rep.durationMinutes || 0) / 60,
      daysWorked: 1,
      workStartTime: rep.workStartTime,
      workEndTime: rep.workEndTime,
      // Timeline data
      entryId: rep.entryId,
      counterTimestamps: rep.counterTimestamps,
      salesLog: rep.salesLog,
      isFinalized: rep.todayStats.isFinalized,
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

  const workingReps = liveReps.filter(r => r.todayStats.doors > 0 || r.todayStats.fp > 0);
  const forgottenReps = liveReps.filter(r => r.hasForgottenEntry && !r.isWorking);

  // Calculate work duration for each rep
  const repsWithDuration = workingReps.map(rep => {
    let durationMinutes = rep.durationMinutes || 0;
    if (!durationMinutes && rep.workStartTime) {
      const start = new Date(rep.workStartTime);
      const end = rep.workEndTime ? new Date(rep.workEndTime) : new Date();
      durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
      durationMinutes -= (rep.breakMinutes || 0);
      durationMinutes = Math.max(0, durationMinutes);
    }
    return { ...rep, durationMinutes };
  });

  // Categorize reps
  // Outstanding: Has FP+ OR has presentations
  const outstanding = repsWithDuration
    .filter(r => r.todayStats.fp > 0 || r.todayStats.presentations > 0)
    .sort((a, b) => {
      if (b.todayStats.fp !== a.todayStats.fp) return b.todayStats.fp - a.todayStats.fp;
      if (b.todayStats.prmr !== a.todayStats.prmr) return b.todayStats.prmr - a.todayStats.prmr;
      return b.todayStats.presentations - a.todayStats.presentations;
    });

  // Need Attention: Working significantly below their historical average (pitches/transitions per hour)
  // Or if no history, under 5 doors after 30+ minutes
  // Or has red flags
  const needAttention = repsWithDuration
    .filter(r => {
      // Skip if they have sales/presentations (they're doing fine)
      if (r.todayStats.fp > 0 || r.todayStats.presentations > 0) return false;
      
      // Check for red flags first
      const redFlags = detectRedFlags(r.todayStats);
      if (redFlags.length > 0) return true;
      
      const hoursWorked = r.durationMinutes / 60;
      if (hoursWorked < 0.5) return false; // Need at least 30 min to judge
      
      // Calculate current pace
      const currentPitchesPerHour = r.todayStats.pitches / hoursWorked;
      const currentTransitionsPerHour = r.todayStats.transitions / hoursWorked;
      
      // If they have historical data, compare to their average
      const hasHistory = (r.avgPitchesPerHour || 0) > 0 || (r.avgTransitionsPerHour || 0) > 0;
      
      if (hasHistory) {
        // Below 50% of their average on BOTH pitches AND transitions
        const pitchRatio = r.avgPitchesPerHour ? currentPitchesPerHour / r.avgPitchesPerHour : 1;
        const transRatio = r.avgTransitionsPerHour ? currentTransitionsPerHour / r.avgTransitionsPerHour : 1;
        return pitchRatio < 0.5 && transRatio < 0.5;
      } else {
        // No history: fallback to absolute threshold (under 5 doors after 30+ min)
        return r.todayStats.doors < 5 && r.durationMinutes >= 30;
      }
    })
    .map(r => {
      // Calculate how far below average they are
      const hoursWorked = r.durationMinutes / 60;
      const currentPitchesPerHour = hoursWorked > 0 ? r.todayStats.pitches / hoursWorked : 0;
      const currentTransitionsPerHour = hoursWorked > 0 ? r.todayStats.transitions / hoursWorked : 0;
      const pitchPct = r.avgPitchesPerHour ? Math.round((currentPitchesPerHour / r.avgPitchesPerHour) * 100) : null;
      const transPct = r.avgTransitionsPerHour ? Math.round((currentTransitionsPerHour / r.avgTransitionsPerHour) * 100) : null;
      const redFlags = detectRedFlags(r.todayStats);
      return { ...r, pitchPct, transPct, redFlags };
    })
    .sort((a, b) => {
      // Sort by worst performance first (lowest percentage of average)
      const aWorst = Math.min(a.pitchPct ?? 100, a.transPct ?? 100);
      const bWorst = Math.min(b.pitchPct ?? 100, b.transPct ?? 100);
      return aWorst - bWorst;
    });

  // Working: Everyone else with activity but not in outstanding or need attention
  const outstandingIds = new Set(outstanding.map(r => r.userId));
  const attentionIds = new Set(needAttention.map(r => r.userId));
  const working = repsWithDuration
    .filter(r => !outstandingIds.has(r.userId) && !attentionIds.has(r.userId))
    .sort((a, b) => b.todayStats.doors - a.todayStats.doors);

  // Calculate team totals
  const totalFP = repsWithDuration.reduce((sum, r) => sum + r.todayStats.fp, 0);
  const totalPRMR = repsWithDuration.reduce((sum, r) => sum + r.todayStats.prmr, 0);

  // Derived counts if not provided
  const actualWorkingCount = workingCount ?? workingReps.length;
  const actualForgottenCount = forgottenCount ?? forgottenReps.length;

  if (workingReps.length === 0 && forgottenReps.length === 0) {
    return (
      <Card className="p-4">
        <h3 className="font-semibold mb-4">{title}</h3>
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <p className="font-medium mb-1">No activity yet today</p>
          <p className="text-sm text-muted-foreground mb-4">
            Time to get out there and make it happen!
          </p>
          <Button 
            onClick={() => navigate('/track')}
            className="gap-2"
          >
            <Activity className="w-4 h-4" />
            Start Your Day
          </Button>
        </div>
      </Card>
    );
  }

  const RepRow = ({ rep, showRank, rank, paceInfo, redFlags, smsType }: { 
    rep: LiveRepData & { durationMinutes: number }; 
    showRank?: boolean; 
    rank?: number;
    paceInfo?: { pitchPct: number | null; transPct: number | null };
    redFlags?: RedFlag[];
    smsType?: 'outstanding' | 'attention' | 'forgotten';
  }) => {
    const hasSales = rep.todayStats.fp > 0;
    const flags = redFlags || detectRedFlags(rep.todayStats);
    
    const handleTextClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!rep.phone) {
        toast.error("No phone number available");
        return;
      }
      const message = generateSmsMessage(rep, smsType || 'attention');
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
                  {stripEmojis(rep.name)}
                </span>
                {/* Red flag badges */}
                {flags.length > 0 && (
                  <div className="flex items-center gap-1">
                    {flags.slice(0, 1).map((flag, i) => (
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
                {rep.workStartTime && (
                  <>
                    <Clock className="w-2.5 h-2.5" />
                    {formatTime(rep.workStartTime)}
                  </>
                )}
                {rep.durationMinutes > 0 && ` · ${formatDuration(rep.durationMinutes)}`}
                {rep.todayStats.doors > 0 && ` · ${rep.todayStats.doors} doors`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 text-right">
            {hasSales ? (
              <>
                <span className="font-semibold text-primary tabular-nums">
                  {rep.todayStats.fp.toFixed(1)} FP+
                </span>
                {rep.todayStats.prmr > 0 && (
                  <span className="font-semibold text-green-700 dark:text-green-500 tabular-nums text-xs">
                    ${rep.todayStats.prmr.toLocaleString()}
                  </span>
                )}
              </>
            ) : rep.todayStats.presentations > 0 ? (
              <span className="font-medium text-amber-600 dark:text-amber-500 tabular-nums">
                {rep.todayStats.presentations} pres
              </span>
            ) : paceInfo && (paceInfo.pitchPct !== null || paceInfo.transPct !== null) ? (
              <span className="text-amber-600 dark:text-amber-500 text-xs">
                {paceInfo.pitchPct !== null && `${paceInfo.pitchPct}% pitch`}
                {paceInfo.pitchPct !== null && paceInfo.transPct !== null && ' · '}
                {paceInfo.transPct !== null && `${paceInfo.transPct}% trans`}
              </span>
            ) : (
              <span className="text-muted-foreground tabular-nums text-xs">
                {rep.todayStats.transitions > 0 ? `${rep.todayStats.transitions} trans` : 
                 rep.todayStats.pitches > 0 ? `${rep.todayStats.pitches} pitch` : ''}
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
            title={`Text ${getFirstName(rep.name)}`}
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
    onToggle,
    onTextAll,
    hasPhones
  }: { 
    icon: any; 
    title: string; 
    count: number; 
    color: string; 
    isOpen: boolean; 
    onToggle: () => void;
    onTextAll?: () => void;
    hasPhones?: boolean;
  }) => (
    <div className={cn(
      "flex items-center justify-between w-full py-2 px-3 rounded-lg transition-colors",
      color
    )}>
      <CollapsibleTrigger 
        onClick={onToggle}
        className="flex items-center gap-2 flex-1"
      >
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">({count})</span>
        <ChevronDown className={cn(
          "w-4 h-4 transition-transform ml-auto",
          isOpen && "rotate-180"
        )} />
      </CollapsibleTrigger>
      
      {/* Text All button */}
      {hasPhones && onTextAll && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTextAll();
          }}
          className="ml-2 text-xs font-medium flex items-center gap-1 px-2 py-1 rounded-md bg-background/50 hover:bg-background/80 transition-colors"
        >
          <MessageSquare className="w-3 h-3" />
          Text All
        </button>
      )}
    </div>
  );

  return (
    <>
      <Card className="p-4">
        {/* Header with summary */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={cn(
                "w-2 h-2 rounded-full",
                actualWorkingCount > 0 ? "bg-green-500" : "bg-muted"
              )} />
              {hasWorkingReps && actualWorkingCount > 0 && (
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping opacity-75" />
              )}
            </div>
            <h3 className="font-semibold">{title}</h3>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn(
              actualWorkingCount > 0 && "text-green-600 dark:text-green-400 font-medium"
            )}>
              {actualWorkingCount} working
            </span>
            {outstanding.length > 0 && (
              <>
                <span>·</span>
                <span className="text-primary font-medium">{outstanding.length} outstanding</span>
              </>
            )}
            {needAttention.length > 0 && (
              <>
                <span>·</span>
                <span className="text-amber-600 dark:text-amber-400 font-medium">{needAttention.length} attention</span>
              </>
            )}
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
                hasPhones={outstanding.some(r => r.phone)}
                onTextAll={() => {
                  const phones = outstanding.filter(r => r.phone).map(r => r.phone!);
                  openGroupSms(phones, "Great work out there today! Keep crushing it! 🔥");
                }}
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
                    <RepRow key={rep.userId} rep={rep} smsType="attention" />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Need Attention */}
          {needAttention.length > 0 && (
            <Collapsible open={attentionOpen} onOpenChange={setAttentionOpen}>
              <SectionHeader
                icon={AlertTriangle}
                title="Need Attention"
                count={needAttention.length}
                color="bg-amber-500/10 hover:bg-amber-500/15 text-amber-600 dark:text-amber-500"
                isOpen={attentionOpen}
                onToggle={() => setAttentionOpen(!attentionOpen)}
                hasPhones={needAttention.some(r => r.phone)}
                onTextAll={() => {
                  const phones = needAttention.filter(r => r.phone).map(r => r.phone!);
                  openGroupSms(phones, "Hey team! Checking in - how's it going out there? Anything I can help with? 💪");
                }}
              />
              <CollapsibleContent className="pt-1">
                <div className="space-y-0.5 pl-1">
                  {needAttention.map((rep) => (
                    <RepRow 
                      key={rep.userId} 
                      rep={rep} 
                      paceInfo={{ pitchPct: rep.pitchPct, transPct: rep.transPct }}
                      redFlags={rep.redFlags}
                      smsType="attention"
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Forgotten Entries */}
          {forgottenReps.length > 0 && (
            <Collapsible open={forgottenOpen} onOpenChange={setForgottenOpen}>
              <SectionHeader
                icon={AlertCircle}
                title="Forgotten Entries"
                count={forgottenReps.length}
                color="bg-orange-500/10 hover:bg-orange-500/15 text-orange-600 dark:text-orange-400"
                isOpen={forgottenOpen}
                onToggle={() => setForgottenOpen(!forgottenOpen)}
                hasPhones={forgottenReps.some(r => r.phone)}
                onTextAll={() => {
                  const phones = forgottenReps.filter(r => r.phone).map(r => r.phone!);
                  openGroupSms(phones, "Hey! Don't forget to save your daily entries! 📋");
                }}
              />
              <CollapsibleContent className="pt-1">
                <div className="space-y-1 pl-1">
                  {forgottenReps.map((rep) => {
                    const handleForgottenTextClick = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (!rep.phone) {
                        toast.error("No phone number available");
                        return;
                      }
                      const message = generateSmsMessage(rep, 'forgotten');
                      openSms(rep.phone, message);
                    };
                    
                    return (
                      <div 
                        key={rep.userId}
                        className="flex items-center justify-between py-2 px-2 rounded-md text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-orange-500" />
                          <span className="font-medium">{stripEmojis(rep.name)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {rep.forgottenDate && format(new Date(rep.forgottenDate + 'T12:00:00'), 'MMM d')}
                          </span>
                          {rep.phone && (
                            <button
                              onClick={handleForgottenTextClick}
                              className="p-1.5 rounded-md text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 transition-colors"
                              title={`Text ${getFirstName(rep.name)}`}
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
