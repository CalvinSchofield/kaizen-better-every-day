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

  // Priority metrics (FP+ > PRMR > hours > doors > transitions > presentations > earliest > latest)
  const priorityMetrics = ['mostFP', 'mostPRMR', 'mostHoursWorked', 'mostDoors', 'mostTransitions', 'mostPresentations', 'earliestDoor', 'latestDoor'];

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
        const entry = board[metric as keyof typeof board] as any;
        if (entry && entry.value > 0) {
          const metricLabel = {
            mostFP: 'Highest FP+',
            mostPRMR: 'Highest PRMR',
            mostHoursWorked: 'Most Hours',
            mostDoors: 'Most Doors',
            mostTransitions: 'Most Transitions',
            mostPresentations: 'Most Presentations',
            earliestDoor: 'Earliest Door',
            latestDoor: 'Latest Door',
          }[metric];

          const isCurrentUser = currentUserId && entry.userId === currentUserId;

          // Format value based on metric type
          let formattedValue = '';
          if (metric === 'mostPRMR') {
            formattedValue = `$${entry.value.toFixed(0)}`;
          } else if (metric === 'mostFP') {
            formattedValue = `${entry.value.toFixed(1)} FP+`;
          } else if (metric === 'mostHoursWorked') {
            formattedValue = `${entry.value.toFixed(1)} hrs`;
          } else if (metric === 'earliestDoor' || metric === 'latestDoor') {
            formattedValue = entry.timeValue || 'N/A';
          } else {
            formattedValue = `${Math.round(entry.value)}`;
          }

          // Calculate "close behind" count if user is leading
          let closeBehindText = '';
          if (isCurrentUser) {
            const allValues = Object.values(board)
              .filter((e: any) => e && e.userId !== currentUserId && typeof e.value === 'number')
              .map((e: any) => e.value);
            
            const threshold = entry.value * 0.9; // Within 10%
            const closeBehindCount = allValues.filter((v: number) => v >= threshold).length;
            
            if (closeBehindCount > 0) {
              closeBehindText = ` · ${closeBehindCount} ${closeBehindCount === 1 ? 'other' : 'others'} close behind`;
            }
          }

          return {
            text: isCurrentUser 
              ? `🎉 You lead ${timeframe} — ${metricLabel.toLowerCase()}: ${formattedValue}${closeBehindText}`
              : `${entry.name} leads ${timeframe} — ${metricLabel.toLowerCase()}: ${formattedValue}`,
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
