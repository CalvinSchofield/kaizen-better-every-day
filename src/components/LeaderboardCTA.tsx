import { useMemo, useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useYesterdayLeaderboard } from "@/hooks/useYesterdayLeaderboard";
import { useWeeklyLeaderboard } from "@/hooks/useWeeklyLeaderboard";
import { useMonthlyLeaderboard } from "@/hooks/useMonthlyLeaderboard";
import { useSeasonLeaderboard } from "@/hooks/useSeasonLeaderboard";
import { useYTDLeaderboard } from "@/hooks/useYTDLeaderboard";
import { supabase } from "@/integrations/supabase/client";

interface LeaderboardCTAProps {
  isOnActiveBlitz: boolean;
  onLeaderboardClick?: () => void;
}

export const LeaderboardCTA = ({ isOnActiveBlitz, onLeaderboardClick }: LeaderboardCTAProps) => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserYear, setCurrentUserYear] = useState<string | null>(null);
  
  // Determine if we're in summer mode (after April 12, 2026)
  const isSummer = useMemo(() => {
    const now = new Date();
    const summerStart = new Date('2026-04-12');
    return now >= summerStart;
  }, []);

  // Rookies should only see rookie leaderboards
  const filterByYear = currentUserYear === 'Rookie' ? 'Rookie' : undefined;

  const { data: ytdBoard } = useYTDLeaderboard(filterByYear);
  const { data: yesterdayBoard } = useYesterdayLeaderboard(filterByYear);
  const { data: weeklyBoard } = useWeeklyLeaderboard(filterByYear);
  const { data: monthlyBoard } = useMonthlyLeaderboard(filterByYear);
  const { data: seasonBoard } = useSeasonLeaderboard(filterByYear, isSummer);

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

  // Priority metrics (FP+ > PRMR > Upgrade FP+ > Upgrade PRMR > hours > presentations > transitions > latest > earliest > pitches > doors)
  const priorityMetrics = ['mostFP', 'mostPRMR', 'mostUpgradeFP', 'mostUpgradePRMR', 'mostHoursWorked', 'mostPresentations', 'mostTransitions', 'latestDoor', 'earliestDoor', 'mostPitches', 'mostDoors'];

  // Find the best available callout based on hierarchy: YTD > Season > Month > Week > Yesterday
  const callout = useMemo(() => {
    const boards = [
      { board: ytdBoard, timeframe: 'year to date' },
      { board: seasonBoard, timeframe: isSummer ? 'this summer' : 'preseason' },
      { board: monthlyBoard, timeframe: 'this month' },
      { board: weeklyBoard, timeframe: 'this week' },
      { board: yesterdayBoard, timeframe: 'yesterday' },
    ];

    for (const { board, timeframe } of boards) {
      if (!board) continue;

      for (const metric of priorityMetrics) {
        const entry = board[metric as keyof typeof board] as any;
        if (entry && entry.value > 0) {
          const metricLabel = {
            mostFP: 'FP+',
            mostPRMR: 'PRMR',
            mostUpgradeFP: 'upgrade FP+',
            mostUpgradePRMR: 'upgrade PRMR',
            mostHoursWorked: 'hours worked',
            mostDoors: 'doors knocked',
            mostTransitions: 'transitions',
            mostPresentations: 'presentations',
            mostPitches: 'pitches',
            earliestDoor: 'earliest door',
            latestDoor: 'latest door',
          }[metric];

          const isCurrentUser = currentUserId && entry.userId === currentUserId;

          // Format value based on metric type
          let formattedValue = '';
          if (metric === 'mostPRMR' || metric === 'mostUpgradePRMR') {
            formattedValue = `$${entry.value.toFixed(0)}`;
          } else if (metric === 'mostFP' || metric === 'mostUpgradeFP') {
            formattedValue = `${entry.value.toFixed(1)} FP+`;
          } else if (metric === 'mostHoursWorked') {
            formattedValue = `${entry.value.toFixed(1)} hrs`;
          } else if (metric === 'earliestDoor' || metric === 'latestDoor') {
            formattedValue = entry.timeValue || 'N/A';
          } else {
            formattedValue = `${Math.round(entry.value)}`;
          }

          // Calculate "close behind" count and gap if user is NOT leading
          let closeBehindText = '';
          let gapText = '';
          
          if (isCurrentUser) {
            const allValues = Object.values(board)
              .filter((e: any) => e && e.userId !== currentUserId && typeof e.value === 'number')
              .map((e: any) => e.value);
            
            const threshold = entry.value * 0.9; // Within 10%
            const closeBehindCount = allValues.filter((v: number) => v >= threshold).length;
            
            if (closeBehindCount > 0) {
              closeBehindText = ` · ${closeBehindCount} ${closeBehindCount === 1 ? 'other' : 'others'} close behind`;
            }
          } else {
            // User is not leading - check if they're close behind
            const userEntry = Object.values(board)
              .find((e: any) => e && e.userId === currentUserId && typeof e.value === 'number') as any;
            
            if (userEntry) {
              const gap = entry.value - userEntry.value;
              const percentBehind = (gap / entry.value) * 100;
              
              if (percentBehind <= 15) { // Within 15% of leader
                if (metric === 'mostPRMR' || metric === 'mostUpgradePRMR') {
                  gapText = ` · You're $${gap.toFixed(0)} behind`;
                } else if (metric === 'mostFP' || metric === 'mostUpgradeFP') {
                  gapText = ` · You're ${gap.toFixed(1)} FP+ behind`;
                } else if (metric === 'mostHoursWorked') {
                  gapText = ` · You're ${gap.toFixed(1)} hrs behind`;
                } else {
                  gapText = ` · You're ${Math.round(gap)} behind`;
                }
              }
            }
          }

          return {
            text: isCurrentUser 
              ? `You're leading the office in ${metricLabel} ${timeframe} at ${formattedValue}${closeBehindText}`
              : `${entry.name} is leading the office in ${metricLabel} ${timeframe} at ${formattedValue}${gapText}`,
            isCurrentUser,
          };
        }
      }
    }

    return null;
  }, [ytdBoard, yesterdayBoard, weeklyBoard, monthlyBoard, seasonBoard, currentUserId, isSummer, priorityMetrics]);

  if (!callout) return null;

  return (
    <button
      onClick={onLeaderboardClick}
      className="group flex items-center gap-3 text-left w-full px-6 py-3 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/15 transition-all mb-3"
    >
      <span className="text-2xl flex-shrink-0">{callout.isCurrentUser ? '🎉' : '🏆'}</span>
      <p className={`text-primary-foreground/90 text-base leading-snug flex-1 ${callout.isCurrentUser ? 'font-bold' : 'font-medium'}`}>
        {callout.text}
      </p>
      <ChevronRight className="w-5 h-5 text-primary-foreground/60 group-hover:translate-x-1 transition-transform flex-shrink-0" />
    </button>
  );
};
