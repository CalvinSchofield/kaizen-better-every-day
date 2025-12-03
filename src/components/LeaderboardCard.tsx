import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp, Flame } from "lucide-react";
import { useYesterdayLeaderboard } from "@/hooks/useYesterdayLeaderboard";
import { useWeeklyLeaderboard } from "@/hooks/useWeeklyLeaderboard";
import { useLastWeekLeaderboard } from "@/hooks/useLastWeekLeaderboard";
import { useMonthlyLeaderboard } from "@/hooks/useMonthlyLeaderboard";
import { useSeasonLeaderboard } from "@/hooks/useSeasonLeaderboard";
import { useYTDLeaderboard } from "@/hooks/useYTDLeaderboard";
import { useTodayLeaderboard } from "@/hooks/useTodayLeaderboard";
import { supabase } from "@/integrations/supabase/client";

type TimeFilter = 'today' | 'ytd' | 'yesterday' | 'week' | 'month' | 'preseason';

export const LeaderboardCard = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserYear, setCurrentUserYear] = useState<string | null>(null);

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

  // Rookies should only see rookie leaderboards
  const filterByYear = currentUserYear === 'Rookie' ? 'Rookie' : undefined;

  const { data: todayBoard } = useTodayLeaderboard(filterByYear);
  const { data: ytdBoard } = useYTDLeaderboard(filterByYear);
  const { data: yesterdayBoard } = useYesterdayLeaderboard(filterByYear);
  const { data: weeklyBoard } = useWeeklyLeaderboard(filterByYear);
  const { data: lastWeekBoard } = useLastWeekLeaderboard(filterByYear);
  const { data: monthlyBoard } = useMonthlyLeaderboard(filterByYear);
  const { data: seasonBoard } = useSeasonLeaderboard(filterByYear);

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
          {/* Filter Pills - Horizontally Scrollable */}
          <div className="pb-4 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 px-6 min-w-max">
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
          </div>
          
          {/* Today Leaderboard - Full Rankings with User Position */}
          {timeFilter === 'today' && todayBoard && (
            <div className="px-6 pb-4 space-y-4">
              {[
                { key: 'fp_plus', label: 'FP+', format: (v: number) => v.toFixed(1) },
                { key: 'prmr', label: 'PRMR', format: (v: number) => `$${v.toFixed(0)}` },
                { key: 'presentations', label: 'Presentations', format: (v: number) => v.toString() },
                { key: 'transitions', label: 'Transitions', format: (v: number) => v.toString() },
                { key: 'pitches', label: 'Pitches', format: (v: number) => v.toString() },
                { key: 'doors_knocked', label: 'Doors Knocked', format: (v: number) => v.toString() },
              ].map(({ key, label, format }) => {
                const rankings = todayBoard.rankings[key as keyof typeof todayBoard.rankings];
                if (rankings.length === 0) return null;

                const userRank = rankings.findIndex(r => r.userId === currentUserId) + 1;
                const userEntry = rankings.find(r => r.userId === currentUserId);
                const isUserInTop3 = userRank > 0 && userRank <= 3;
                const leader = rankings[0];
                const gap = leader && userEntry ? leader.value - userEntry.value : 0;

                // Only show encouraging message when within striking distance (rank 2-3)
                const getEncouragement = () => {
                  if (userRank === 2 && gap > 0) return `${gap.toFixed(key === 'fp_plus' ? 1 : 0)} behind — you got this!`;
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
                      {rankings.slice(0, 3).map((entry, idx) => (
                        <div 
                          key={entry.userId}
                          className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                            entry.userId === currentUserId ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/30'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-muted-foreground w-6">#{idx + 1}</span>
                            {entry.userId === currentUserId && <span className="text-primary">⭐</span>}
                            <span className={`text-sm ${entry.userId === currentUserId ? 'font-bold text-primary' : 'font-medium'}`}>
                              {entry.userId === currentUserId ? 'You' : entry.name}
                            </span>
                          </div>
                          <span className="text-sm font-bold">{format(entry.value)}</span>
                        </div>
                      ))}
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
                        <span className={`text-sm font-semibold ${isCurrentUser ? 'text-primary' : 'text-foreground'}`}>
                          {isCurrentUser ? 'You' : entry.name} {isCurrentUser && '⭐'}
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
    </div>
  );
};
