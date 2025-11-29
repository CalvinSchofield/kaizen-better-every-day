import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useYesterdayLeaderboard } from "@/hooks/useYesterdayLeaderboard";
import { useWeeklyLeaderboard } from "@/hooks/useWeeklyLeaderboard";
import { useMonthlyLeaderboard } from "@/hooks/useMonthlyLeaderboard";
import { useSeasonLeaderboard } from "@/hooks/useSeasonLeaderboard";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState as useReactState } from "react";

type TimeFilter = 'yesterday' | 'week' | 'month' | 'season';

export const LeaderboardCard = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('yesterday');
  const [currentUserId, setCurrentUserId] = useReactState<string | null>(null);

  const { data: yesterdayBoard } = useYesterdayLeaderboard();
  const { data: weeklyBoard } = useWeeklyLeaderboard();
  const { data: monthlyBoard } = useMonthlyLeaderboard();
  const { data: seasonBoard } = useSeasonLeaderboard();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

  const currentBoard = 
    timeFilter === 'yesterday' ? yesterdayBoard :
    timeFilter === 'week' ? weeklyBoard :
    timeFilter === 'month' ? monthlyBoard :
    seasonBoard;

  const categories = [
    { key: 'mostFP', label: 'Highest FP+', format: (v: number) => `${v.toFixed(1)} FP+` },
    { key: 'mostPRMR', label: 'Highest PRMR', format: (v: number) => `$${v.toFixed(0)}` },
    { key: 'mostHoursWorked', label: 'Most Hours', format: (v: number) => `${v.toFixed(1)} hrs` },
    { key: 'mostDoors', label: 'Most Doors', format: (v: number) => `${v}` },
    { key: 'mostTransitions', label: 'Most Transitions', format: (v: number) => `${v}` },
    { key: 'mostPresentations', label: 'Most Presentations', format: (v: number) => `${v}` },
    { key: 'earliestDoor', label: 'Earliest Door', format: (_v: number, timeValue?: string) => timeValue || 'N/A' },
    { key: 'latestDoor', label: 'Latest Door', format: (_v: number, timeValue?: string) => timeValue || 'N/A' },
  ];

  const userLeadCount = currentBoard
    ? categories.filter(cat => {
        const entry = currentBoard[cat.key as keyof typeof currentBoard];
        return entry && (entry as any).userId === currentUserId;
      }).length
    : 0;

  const totalLeaders = currentBoard
    ? new Set(
        categories
          .map(cat => currentBoard[cat.key as keyof typeof currentBoard])
          .filter(Boolean)
          .map((entry: any) => entry.userId)
      ).size
    : 0;

  return (
    <div className="w-full rounded-lg bg-card border border-border mb-6">
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

      {/* Filter Pills - Always Visible */}
      <div className="px-6 pb-4 flex gap-2">
        {(['yesterday', 'week', 'month', 'season'] as TimeFilter[]).map((filter) => (
          <button
            key={filter}
            onClick={() => setTimeFilter(filter)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              timeFilter === filter
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            {filter === 'yesterday' ? 'Yesterday' : filter === 'week' ? 'Week' : filter === 'month' ? 'Month' : 'Season'}
          </button>
        ))}
      </div>

      {/* Summary - Always Visible */}
      {!isExpanded && (
        <div className="px-6 pb-4">
          <p className="text-muted-foreground text-sm">
            {userLeadCount > 0 && `${userLeadCount} ${userLeadCount === 1 ? 'category' : 'categories'} led by you · `}
            {totalLeaders} total {totalLeaders === 1 ? 'leader' : 'leaders'}
          </p>
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-6 pb-4 space-y-3 border-t border-border pt-4">
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
  );
};
