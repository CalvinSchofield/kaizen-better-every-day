import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useYesterdayLeaderboard } from "@/hooks/useYesterdayLeaderboard";
import { useWeeklyLeaderboard } from "@/hooks/useWeeklyLeaderboard";
import { useMonthlyLeaderboard } from "@/hooks/useMonthlyLeaderboard";
import { useSeasonLeaderboard } from "@/hooks/useSeasonLeaderboard";
import { useYTDLeaderboard } from "@/hooks/useYTDLeaderboard";
import { useTodayLeaderboard } from "@/hooks/useTodayLeaderboard";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState as useReactState } from "react";

type TimeFilter = 'today' | 'ytd' | 'yesterday' | 'week' | 'month' | 'preseason';

export const LeaderboardCard = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [currentUserId, setCurrentUserId] = useReactState<string | null>(null);
  const [currentUserYear, setCurrentUserYear] = useReactState<string | null>(null);

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
  const { data: monthlyBoard } = useMonthlyLeaderboard(filterByYear);
  const { data: seasonBoard } = useSeasonLeaderboard(filterByYear);

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
          {/* Filter Pills - Expanded State Only */}
          <div className="px-6 pb-4 flex gap-2 flex-wrap">
            <button
              onClick={() => setTimeFilter('today')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                timeFilter === 'today'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              Today <span className="text-xs opacity-70">Live</span>
            </button>
            {(['ytd', 'preseason', 'month', 'week', 'yesterday'] as TimeFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  timeFilter === filter
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {filter === 'ytd' ? 'YTD' : filter === 'yesterday' ? 'Yesterday' : filter === 'week' ? 'Week' : filter === 'month' ? 'Month' : 'Preseason'}
              </button>
            ))}
          </div>
          
          {/* Today Leaderboard - Full Rankings */}
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

                return (
                  <div key={key} className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground">{label}</h3>
                    <div className="space-y-1">
                      {rankings.slice(0, 3).map((entry, idx) => (
                        <div 
                          key={entry.userId}
                          className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                            entry.userId === currentUserId ? 'bg-primary/10' : 'bg-secondary/30'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-muted-foreground w-6">#{idx + 1}</span>
                            {entry.userId === currentUserId && <span className="text-primary">⭐</span>}
                            <span className={`text-sm ${entry.userId === currentUserId ? 'font-bold' : 'font-medium'}`}>
                              {entry.name}
                            </span>
                          </div>
                          <span className="text-sm font-bold">{format(entry.value)}</span>
                        </div>
                      ))}
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

            return (
              <div key={key} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🥇</span>
                  <span className="text-foreground text-sm font-medium">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${isCurrentUser ? 'text-primary' : 'text-foreground'}`}>
                    {isCurrentUser ? 'You' : entry.name} {isCurrentUser && '⭐'}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {format(entry.value, entry.timeValue)}
                  </span>
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
