import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp, Flame } from "lucide-react";
import { useYesterdayLeaderboard } from "@/hooks/useYesterdayLeaderboard";
import { useWeeklyLeaderboard } from "@/hooks/useWeeklyLeaderboard";
import { useLastWeekLeaderboard } from "@/hooks/useLastWeekLeaderboard";
import { useMonthlyLeaderboard } from "@/hooks/useMonthlyLeaderboard";
import { useSeasonLeaderboard } from "@/hooks/useSeasonLeaderboard";
import { useYTDLeaderboard } from "@/hooks/useYTDLeaderboard";
import { useTodayLeaderboard } from "@/hooks/useTodayLeaderboard";
import { useWorkingStatus } from "@/hooks/useWorkingStatus";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { supabase } from "@/integrations/supabase/client";
import { RepDetailDrawer } from "@/components/reports/RepDetailDrawer";

interface SelectedRepData {
  userId: string;
  name: string;
  year: string;
  teamName: string;
  mgmtGroupName: string;
  doors: number;
  dms: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  fp: number;
  upgradeFP: number;
  prmr: number;
  upgradePRMR: number;
  doorsToFpRatio: number;
  hoursWorked: number;
  workStartTime?: string;
  workEndTime?: string;
  counterTimestamps?: Record<string, string[]>;
  salesLog?: Array<{ type: string; prmr: number; timestamp?: string }>;
  isFinalized?: boolean;
  entryId?: string;
}

// Working status indicator component
const WorkingIndicator = ({ isWorking, hasForgottenEntry, isCurrentUser }: { 
  isWorking: boolean; 
  hasForgottenEntry?: boolean;
  isCurrentUser?: boolean;
}) => {
  // Don't show for current user
  if (isCurrentUser) return null;
  
  if (isWorking) {
    return (
      <span className="relative flex h-2 w-2 ml-1" title="Currently working">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
      </span>
    );
  }
  
  if (hasForgottenEntry) {
    return (
      <span className="relative flex h-2 w-2 ml-1" title="Has unsaved work">
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
      </span>
    );
  }
  
  return null;
};

type TimeFilter = 'today' | 'ytd' | 'yesterday' | 'week' | 'month' | 'preseason';
type ScopeFilter = 'all' | 'rookies';

export const LeaderboardCard = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserYear, setCurrentUserYear] = useState<string | null>(null);
  const [selectedRep, setSelectedRep] = useState<SelectedRepData | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter | null>(null); // null = not initialized yet

  const { data: teamAccess } = useTeamAccess();
  
  // Check if current user is a leader with downline access
  const isLeader = teamAccess?.accessLevel && teamAccess.accessLevel !== 'none';
  const accessibleUserIds = teamAccess?.accessibleUserIds || [];

  // Listen for expand event from CTA
  useEffect(() => {
    const handleExpand = (e: Event) => {
      const customEvent = e as CustomEvent<{ timeframe: TimeFilter }>;
      setIsExpanded(true);
      if (customEvent.detail?.timeframe) {
        setTimeFilter(customEvent.detail.timeframe);
      }
    };
    window.addEventListener('expandLeaderboard', handleExpand);
    return () => window.removeEventListener('expandLeaderboard', handleExpand);
  }, []);

  // Set default scope filter based on user's year (only once when year is loaded)
  useEffect(() => {
    if (currentUserYear && scopeFilter === null) {
      setScopeFilter(currentUserYear === 'Rookie' ? 'rookies' : 'all');
    }
  }, [currentUserYear, scopeFilter]);

  // Determine actual filter value - rookies only see rookie data when scope is "rookies"
  const filterByYear = scopeFilter === 'rookies' ? 'Rookie' : undefined;

  const { data: todayBoard } = useTodayLeaderboard(filterByYear);
  const { data: ytdBoard } = useYTDLeaderboard(filterByYear);
  const { data: yesterdayBoard } = useYesterdayLeaderboard(filterByYear);
  const { data: weeklyBoard } = useWeeklyLeaderboard(filterByYear);
  const { data: lastWeekBoard } = useLastWeekLeaderboard(filterByYear);
  const { data: monthlyBoard } = useMonthlyLeaderboard(filterByYear);
  const { data: seasonBoard } = useSeasonLeaderboard(filterByYear);
  const { data: workingStatus } = useWorkingStatus();

  // Calculate weekly streaks - same person leads this week AND last week
  const weeklyStreaks = useMemo(() => {
    if (!weeklyBoard || !lastWeekBoard) return new Map<string, string[]>();
    
    const streaks = new Map<string, string[]>();
    const metricKeys = ['mostFP', 'mostPRMR', 'mostUpgradeFP', 'mostHoursWorked', 'mostDoors', 'mostTransitions', 'mostPresentations', 'mostPitches'];
    
    metricKeys.forEach(key => {
      const thisWeekEntry = weeklyBoard[key as keyof typeof weeklyBoard] as any;
      const lastWeekEntry = lastWeekBoard[key as keyof typeof lastWeekBoard] as any;
      
      if (thisWeekEntry?.userId && lastWeekEntry?.userId && thisWeekEntry.userId === lastWeekEntry.userId) {
        const existing = streaks.get(thisWeekEntry.userId) || [];
        existing.push(key);
        streaks.set(thisWeekEntry.userId, existing);
      }
    });
    
    return streaks;
  }, [weeklyBoard, lastWeekBoard]);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        
        // Fetch user's year from reps table
        const { data: repData } = await supabase
          .from('reps')
          .select('year')
          .eq('user_id', user.id)
          .single();
        
        if (repData) {
          setCurrentUserYear(repData.year);
        }
      }
    };
    
    fetchUser();
  }, []);

  const currentBoard = 
    timeFilter === 'today' ? null : // Today uses different structure
    timeFilter === 'ytd' ? ytdBoard :
    timeFilter === 'yesterday' ? yesterdayBoard :
    timeFilter === 'week' ? weeklyBoard :
    timeFilter === 'month' ? monthlyBoard :
    timeFilter === 'preseason' ? seasonBoard :
    ytdBoard;

  const categories = [
    { key: 'mostFP', label: 'Highest FP+', format: (v: number) => `${v.toFixed(1)} FP+` },
    { key: 'mostPRMR', label: 'Highest PRMR', format: (v: number) => `$${v.toFixed(0)}` },
    { key: 'mostUpgradeFP', label: 'Highest Upgrade FP+', format: (v: number) => `${v.toFixed(1)} FP+` },
    { key: 'mostHoursWorked', label: 'Most Hours', format: (v: number) => `${v.toFixed(1)} hrs` },
    { key: 'mostDoors', label: 'Most Doors', format: (v: number) => `${v}` },
    { key: 'mostTransitions', label: 'Most Transitions', format: (v: number) => `${v}` },
    { key: 'mostPresentations', label: 'Most Presentations', format: (v: number) => `${v}` },
    { key: 'earliestDoor', label: 'Earliest Door', format: (_v: number, timeValue?: string) => timeValue || 'N/A' },
    { key: 'latestDoor', label: 'Latest Door', format: (_v: number, timeValue?: string) => timeValue || 'N/A' },
  ];

  // Priority hierarchy for finding user highlights
  const priorityMetrics = [
    { key: 'mostFP', label: 'FP+' },
    { key: 'mostPRMR', label: 'PRMR' },
    { key: 'mostUpgradeFP', label: 'upgrade FP+' },
    { key: 'mostHoursWorked', label: 'hours' },
    { key: 'mostPresentations', label: 'presentations' },
    { key: 'mostTransitions', label: 'transitions' },
    { key: 'latestDoor', label: 'latest door' },
    { key: 'earliestDoor', label: 'earliest door' },
    { key: 'mostPitches', label: 'pitches' },
    { key: 'mostDoors', label: 'doors' },
  ];

  const findUserHighlight = () => {
    const boards = [
      { board: ytdBoard, timeframe: 'year to date' },
      { board: seasonBoard, timeframe: 'preseason' },
      { board: monthlyBoard, timeframe: 'this month' },
      { board: weeklyBoard, timeframe: 'this week' },
      { board: yesterdayBoard, timeframe: 'yesterday' },
    ];
    
    // Find first match where user is leading
    for (const { board, timeframe } of boards) {
      if (!board) continue;
      for (const { key, label } of priorityMetrics) {
        const entry = board[key as keyof typeof board] as any;
        if (entry?.userId === currentUserId && entry.value > 0) {
          return { metric: label, timeframe, isUserLeading: true };
        }
      }
    }
    
    // Fallback: show top FP+ leader
    for (const { board, timeframe } of boards) {
      if (!board) continue;
      const fpEntry = board.mostFP as any;
      if (fpEntry?.value > 0) {
        return { 
          name: fpEntry.name, 
          value: fpEntry.value.toFixed(1), 
          timeframe,
          isUserLeading: false 
        };
      }
    }
    return null;
  };

  const highlight = findUserHighlight();

  // Handler to open rep detail drawer
  const handleRepClick = async (userId: string, name: string) => {
    // Only allow if leader and rep is in their downline
    if (!isLeader || !accessibleUserIds.includes(userId) || userId === currentUserId) return;

    // Get today's date in user's local timezone
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Fetch today's entry and rep info in parallel
    const [entryResult, repInfoResult] = await Promise.all([
      supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('entry_date', todayStr)
        .maybeSingle(),
      supabase
        .from('reps')
        .select('year, team_leader')
        .eq('user_id', userId)
        .maybeSingle()
    ]);

    const entry = entryResult.data;
    const repInfo = repInfoResult.data;
    
    // Find team/mgmt group from teamAccess data
    const accessibleRep = teamAccess?.accessibleReps?.find(r => r.userId === userId);
    const team = teamAccess?.teams?.find(t => t.id === repInfo?.team_leader);

    // For unfinalized entries, calculate FP+ and PRMR from sales_log
    const salesLog = entry?.sales_log as Array<{ type: string; prmr: number; timestamp?: string }> | undefined;
    const isFinalized = entry?.is_finalized || false;
    
    let fpValue = 0;
    let prmrValue = 0;
    let upgradePrmrValue = 0;
    
    if (isFinalized) {
      // Use finalized column values
      fpValue = entry?.fp_plus || 0;
      prmrValue = entry?.prmr || 0;
      upgradePrmrValue = entry?.upgrade_prmr || 0;
    } else if (salesLog && salesLog.length > 0) {
      // Calculate from sales_log for unfinalized entries
      salesLog.forEach(sale => {
        if (sale.type === 'fp') {
          fpValue += 1;
          prmrValue += sale.prmr || 0;
        } else if (sale.type === 'upgrade') {
          upgradePrmrValue += sale.prmr || 0;
        }
      });
    }

    const repData: SelectedRepData = {
      userId,
      name,
      year: repInfo?.year || 'Unknown',
      teamName: team?.name || 'Unknown Team',
      mgmtGroupName: teamAccess?.mgmtGroups?.find(g => g.teamIds.includes(team?.id || ''))?.name || '',
      doors: entry?.doors_knocked || 0,
      dms: entry?.decision_makers || 0,
      pitches: entry?.pitches || 0,
      transitions: entry?.transitions || 0,
      presentations: entry?.presentations || 0,
      closes: entry?.closes || 0,
      fp: fpValue + (upgradePrmrValue / 85), // FP+ = FP count + upgrade_prmr/85
      upgradeFP: upgradePrmrValue / 85,
      prmr: prmrValue,
      upgradePRMR: upgradePrmrValue,
      doorsToFpRatio: 0,
      hoursWorked: 0,
      workStartTime: entry?.work_start_time || undefined,
      workEndTime: entry?.work_end_time || undefined,
      isFinalized,
      counterTimestamps: entry?.counter_timestamps as Record<string, string[]> | undefined,
      salesLog,
      entryId: entry?.id,
    };

    // Calculate hours worked
    if (entry?.work_start_time && entry?.work_end_time) {
      const start = new Date(entry.work_start_time);
      const end = new Date(entry.work_end_time);
      const breakMinutes = Array.isArray(entry.break_periods) 
        ? entry.break_periods.reduce((sum: number, bp: any) => sum + (bp.duration || 0), 0)
        : 0;
      repData.hoursWorked = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60) - breakMinutes / 60);
    }

    // Calculate doors to FP ratio (fp already includes upgrade FP)
    if (repData.fp > 0) {
      repData.doorsToFpRatio = repData.doors / repData.fp;
    }

    setSelectedRep(repData);
    setIsDrawerOpen(true);
  };

  // Check if a user can be clicked (leader with access to that rep)
  const canClickRep = (userId: string) => {
    return isLeader && accessibleUserIds.includes(userId) && userId !== currentUserId;
  };

  return (
    <div className="w-full rounded-lg bg-card border border-border mb-6" data-leaderboard-card>
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-accent/5 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏆</span>
          <span className="text-foreground text-lg font-semibold">Leaderboard</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {/* Summary - Collapsed State Only */}
      {!isExpanded && highlight && (
        <div className="px-6 pb-4">
          <p className="text-foreground text-sm">
            {highlight.isUserLeading ? (
              <>
                <span className="text-primary font-medium">You're leading</span> in{' '}
                <span className="text-primary font-medium">{highlight.metric}</span>{' '}
                {highlight.timeframe}
              </>
            ) : (
              <>
                <span className="font-medium">{highlight.name}</span> leads FP+ {highlight.timeframe} at{' '}
                <span className="text-primary font-medium">{highlight.value}</span>
              </>
            )}
          </p>
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border pt-4">
          {/* Filter Pills Row - Time and Scope */}
          <div className="pb-4 overflow-x-auto scrollbar-hide">
            <div className="flex items-center justify-between px-6 gap-4">
              {/* Time Filter Pills */}
              <div className="flex gap-2 min-w-max">
                {[
                  { key: 'today' as TimeFilter, label: 'Live', isLive: true },
                  { key: 'yesterday' as TimeFilter, label: 'Yesterday' },
                  { key: 'week' as TimeFilter, label: 'Week' },
                  { key: 'month' as TimeFilter, label: 'Month' },
                  { key: 'preseason' as TimeFilter, label: 'Preseason' },
                  { key: 'ytd' as TimeFilter, label: 'YTD' },
                ].map(({ key, label, isLive }) => (
                  <button
                    key={key}
                    onClick={() => setTimeFilter(key)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                      timeFilter === key
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {label}
                    {isLive && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${timeFilter === key ? 'bg-green-300' : 'bg-green-500'}`}></span>
                      </span>
                    )}
                  </button>
                ))}
              </div>
              
              {/* Scope Toggle - Rookies/All */}
              <div className="flex items-center gap-1 bg-secondary/50 rounded-full p-0.5 shrink-0">
                <button
                  onClick={() => setScopeFilter('rookies')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    scopeFilter === 'rookies'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Rookies
                </button>
                <button
                  onClick={() => setScopeFilter('all')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    scopeFilter === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All
                </button>
              </div>
            </div>
          </div>
          
          {/* Today Leaderboard - Full Rankings with User Position */}
          {timeFilter === 'today' && todayBoard && (
            <div className="px-6 pb-4 space-y-4">
              {/* Top FP+ and PRMR - Same format as other timeframes */}
              {(() => {
                const topFP = todayBoard.rankings.fp_plus[0];
                const topPRMR = todayBoard.rankings.prmr[0];
                const topCategories = [
                  { entry: topFP, label: 'Highest FP+', format: (v: number) => `${v.toFixed(1)} FP+` },
                  { entry: topPRMR, label: 'Highest PRMR', format: (v: number) => `$${v.toFixed(0)}` },
                ].filter(c => c.entry && c.entry.value > 0);

                if (topCategories.length === 0) return null;

                return (
                  <div className="space-y-3 border-b border-border pb-4 mb-2">
                    {topCategories.map(({ entry, label, format }) => {
                      const isCurrentUser = currentUserId && entry.userId === currentUserId;
                      return (
                        <div key={label} className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">🥇</span>
                            <span className="text-foreground text-sm font-medium">{label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold flex items-center ${isCurrentUser ? 'text-primary' : 'text-foreground'}`}>
                              {isCurrentUser ? 'You' : entry.name} {isCurrentUser && '⭐'}
                              <WorkingIndicator 
                                isWorking={entry.isWorking || false}
                                isCurrentUser={isCurrentUser || false}
                              />
                            </span>
                            <span className={`text-sm font-bold ${label.includes('PRMR') ? 'text-green-700 dark:text-green-500' : ''}`}>
                              {format(entry.value)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Combined FP+ & PRMR Rankings */}
              {(() => {
                const fpRankings = todayBoard.rankings.fp_plus.filter(r => r.value > 0);
                const prmrMap = new Map(todayBoard.rankings.prmr.map(r => [r.userId, r.value]));
                
                if (fpRankings.length === 0) return null;
                
                const userRank = fpRankings.findIndex(r => r.userId === currentUserId) + 1;
                const userEntry = fpRankings.find(r => r.userId === currentUserId);
                const userPrmr = userEntry ? prmrMap.get(userEntry.userId) || 0 : 0;
                
                return (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground">Sales</h3>
                    <div className="space-y-1">
                      {fpRankings.slice(0, 5).map((entry, idx) => {
                        const prmr = prmrMap.get(entry.userId) || 0;
                        const clickable = canClickRep(entry.userId);
                        return (
                          <div 
                            key={entry.userId}
                            onClick={() => clickable && handleRepClick(entry.userId, entry.name)}
                            className={`flex items-center justify-between py-2 px-3 rounded-lg transition-colors ${
                              entry.userId === currentUserId ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/30'
                            } ${clickable ? 'cursor-pointer hover:bg-accent/20' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-muted-foreground w-6">#{idx + 1}</span>
                              {entry.userId === currentUserId && <span className="text-primary">⭐</span>}
                              <span className={`text-sm flex items-center ${entry.userId === currentUserId ? 'font-bold text-primary' : 'font-medium'}`}>
                                {entry.userId === currentUserId ? 'You' : entry.name}
                                <WorkingIndicator 
                                  isWorking={entry.isWorking || false} 
                                  isCurrentUser={entry.userId === currentUserId}
                                />
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">{entry.value.toFixed(1)} FP+</span>
                              {prmr > 0 && (
                                <span className="text-sm font-bold text-green-700 dark:text-green-500">${prmr.toFixed(0)}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {userRank > 5 && userEntry && (
                        <>
                          <div className="text-center text-xs text-muted-foreground py-1">···</div>
                          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-primary/10 border border-primary/20">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-muted-foreground w-6">#{userRank}</span>
                              <span className="text-primary">⭐</span>
                              <span className="text-sm font-bold text-primary">You</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">{userEntry.value.toFixed(1)} FP+</span>
                              {userPrmr > 0 && (
                                <span className="text-sm font-bold text-green-700 dark:text-green-500">${userPrmr.toFixed(0)}</span>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Activity Rankings */}
              {[
                { key: 'presentations', label: 'Presentations', format: (v: number) => v.toString() },
                { key: 'transitions', label: 'Transitions', format: (v: number) => v.toString() },
                { key: 'pitches', label: 'Pitches', format: (v: number) => v.toString() },
                { key: 'doors_knocked', label: 'Doors Knocked', format: (v: number) => v.toString() },
              ].map(({ key, label, format }) => {
                const rankings = todayBoard.rankings[key as keyof typeof todayBoard.rankings];
                if (rankings.length === 0) return null;

                const userRank = rankings.findIndex(r => r.userId === currentUserId) + 1;
                const userEntry = rankings.find(r => r.userId === currentUserId);
                const leader = rankings[0];
                const gap = leader && userEntry ? leader.value - userEntry.value : 0;

                // Only show encouraging message when within striking distance (rank 2-3)
                const getEncouragement = () => {
                  if (userRank === 2 && gap > 0) return `${gap.toFixed(0)} behind — you got this!`;
                  if (userRank === 3) return "Top 3! Keep pushing! 💪";
                  return null;
                };

                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-muted-foreground">{label}</h3>
                      {userRank > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {getEncouragement()}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {rankings.slice(0, 3).map((entry, idx) => {
                        const clickable = canClickRep(entry.userId);
                        return (
                          <div 
                            key={entry.userId}
                            onClick={() => clickable && handleRepClick(entry.userId, entry.name)}
                            className={`flex items-center justify-between py-2 px-3 rounded-lg transition-colors ${
                              entry.userId === currentUserId ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/30'
                            } ${clickable ? 'cursor-pointer hover:bg-accent/20' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-muted-foreground w-6">#{idx + 1}</span>
                              {entry.userId === currentUserId && <span className="text-primary">⭐</span>}
                              <span className={`text-sm flex items-center ${entry.userId === currentUserId ? 'font-bold text-primary' : 'font-medium'}`}>
                                {entry.userId === currentUserId ? 'You' : entry.name}
                                <WorkingIndicator 
                                  isWorking={entry.isWorking || false} 
                                  isCurrentUser={entry.userId === currentUserId}
                                />
                              </span>
                            </div>
                            <span className="text-sm font-bold">{format(entry.value)}</span>
                          </div>
                        );
                      })}
                      {/* Show user's position if not in top 3 */}
                      {userRank > 3 && userEntry && (
                        <>
                          <div className="text-center text-xs text-muted-foreground py-1">···</div>
                          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-primary/10 border border-primary/20">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-muted-foreground w-6">#{userRank}</span>
                              <span className="text-primary">⭐</span>
                              <span className="text-sm font-bold text-primary">You</span>
                            </div>
                            <span className="text-sm font-bold">{format(userEntry.value)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Standard Leaderboard Categories */}
          {timeFilter !== 'today' && (
            <div className="px-6 pb-4 space-y-3">
              {categories.map(({ key, label, format }) => {
                const entry = currentBoard?.[key as keyof typeof currentBoard] as any;
                
                if (!entry || entry.value <= 0) {
                  return (
                    <div key={key} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🥇</span>
                        <span className="text-muted-foreground text-sm">{label}</span>
                      </div>
                      <span className="text-muted-foreground text-sm">No data yet</span>
                    </div>
                  );
                }

                const isCurrentUser = currentUserId && entry.userId === currentUserId;
                
                // Check if this leader has a weekly streak for this metric
                const hasStreak = timeFilter === 'week' && weeklyStreaks.get(entry.userId)?.includes(key);
                
                // Check if this person is currently working TODAY (cross-reference)
                const userWorkingStatus = workingStatus?.get(entry.userId);

                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🥇</span>
                        <span className="text-foreground text-sm font-medium">{label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasStreak && (
                          <span className="flex items-center gap-0.5 text-xs text-orange-500 font-medium bg-orange-500/10 px-1.5 py-0.5 rounded-full">
                            <Flame className="w-3 h-3" />
                            2 weeks
                          </span>
                        )}
                        <span className={`text-sm font-semibold flex items-center ${isCurrentUser ? 'text-primary' : 'text-foreground'}`}>
                          {isCurrentUser ? 'You' : entry.name} {isCurrentUser && '⭐'}
                          <WorkingIndicator 
                            isWorking={userWorkingStatus?.isWorking || false}
                            hasForgottenEntry={userWorkingStatus?.hasForgottenEntry}
                            isCurrentUser={!!isCurrentUser}
                          />
                        </span>
                        <span className="text-muted-foreground text-sm">
                          {format(entry.value, entry.timeValue)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Rep Detail Drawer */}
      {selectedRep && (
        <RepDetailDrawer
          open={isDrawerOpen}
          onOpenChange={(open) => {
            setIsDrawerOpen(open);
            if (!open) setSelectedRep(null);
          }}
          rep={selectedRep}
        />
      )}
    </div>
  );
};
