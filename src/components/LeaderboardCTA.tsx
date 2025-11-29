import { useMemo, useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useYesterdayLeaderboard } from "@/hooks/useYesterdayLeaderboard";
import { useWeeklyLeaderboard } from "@/hooks/useWeeklyLeaderboard";
import { useMonthlyLeaderboard } from "@/hooks/useMonthlyLeaderboard";
import { useSeasonLeaderboard } from "@/hooks/useSeasonLeaderboard";
import { supabase } from "@/integrations/supabase/client";

interface LeaderboardCTAProps {
  isOnActiveBlitz: boolean;
  onLeaderboardClick?: () => void;
}

export const LeaderboardCTA = ({ isOnActiveBlitz, onLeaderboardClick }: LeaderboardCTAProps) => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Determine if we're in summer mode (after April 12, 2026)
  const isSummer = useMemo(() => {
    const now = new Date();
    const summerStart = new Date('2026-04-12');
    return now >= summerStart;
  }, []);

  const { data: yesterdayBoard } = useYesterdayLeaderboard();
  const { data: weeklyBoard } = useWeeklyLeaderboard();
  const { data: monthlyBoard } = useMonthlyLeaderboard();
  const { data: seasonBoard } = useSeasonLeaderboard(undefined, isSummer);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

  // Priority metrics (most valuable first)
  const priorityMetrics = ['mostFP', 'mostPRMR', 'mostTransitions', 'mostPresentations', 'mostDoors', 'mostPitches'];

  // Find the best available callout based on hierarchy: yesterday > week > month > season
  const callout = useMemo(() => {
    const boards = [
      { board: yesterdayBoard, timeframe: 'yesterday' },
      { board: weeklyBoard, timeframe: 'this week' },
      { board: monthlyBoard, timeframe: 'this month' },
      { board: seasonBoard, timeframe: isSummer ? 'this summer' : 'preseason' },
    ];

    for (const { board, timeframe } of boards) {
      if (!board) continue;

      for (const metric of priorityMetrics) {
        const entry = board[metric as keyof typeof board];
        if (entry && entry.value > 0) {
          const metricLabel = {
            mostFP: 'Highest FP+',
            mostPRMR: 'Highest PRMR',
            mostTransitions: 'Most Transitions',
            mostPresentations: 'Most Presentations',
            mostDoors: 'Most Doors',
            mostPitches: 'Most Pitches',
          }[metric];

          const isCurrentUser = currentUserId && entry.userId === currentUserId;

          return {
            text: isCurrentUser 
              ? `🎉 You lead ${timeframe} — ${metricLabel.toLowerCase()}: ${metric === 'mostPRMR' ? '$' : ''}${metric === 'mostFP' ? entry.value.toFixed(1) : metric === 'mostPRMR' ? entry.value.toFixed(1) : entry.value}${metric === 'mostFP' ? ' FP+' : ''}`
              : `${entry.name} leads ${timeframe} — ${metricLabel.toLowerCase()}: ${metric === 'mostPRMR' ? '$' : ''}${metric === 'mostFP' ? entry.value.toFixed(1) : metric === 'mostPRMR' ? entry.value.toFixed(1) : entry.value}${metric === 'mostFP' ? ' FP+' : ''}`,
            isCurrentUser,
          };
        }
      }
    }

    return null;
  }, [yesterdayBoard, weeklyBoard, monthlyBoard, seasonBoard, currentUserId, isSummer, priorityMetrics]);

  if (!callout) return null;

  return (
    <button
      onClick={onLeaderboardClick}
      className="group flex items-center gap-3 text-left w-full px-6 py-3 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/15 transition-all mb-3"
    >
      <span className="text-2xl flex-shrink-0">{callout.isCurrentUser ? '🎉' : '🏆'}</span>
      <p className="text-primary-foreground/90 text-base font-medium leading-snug flex-1">
        {callout.text}
      </p>
      <ChevronRight className="w-5 h-5 text-primary-foreground/60 group-hover:translate-x-1 transition-transform flex-shrink-0" />
    </button>
  );
};
