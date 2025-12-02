import { useMemo, useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useYesterdayLeaderboard } from "@/hooks/useYesterdayLeaderboard";
import { useWeeklyLeaderboard } from "@/hooks/useWeeklyLeaderboard";
import { useMonthlyLeaderboard } from "@/hooks/useMonthlyLeaderboard";
import { useSeasonLeaderboard } from "@/hooks/useSeasonLeaderboard";
import { useYTDLeaderboard } from "@/hooks/useYTDLeaderboard";
import { useTodayLeaderboard } from "@/hooks/useTodayLeaderboard";
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

  const { data: todayBoard } = useTodayLeaderboard(filterByYear);
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

  // Check if we're in knocking hours
  const isKnockingHours = useMemo(() => {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hour = now.getHours();
    
    // Monday-Friday: noon (12) to 9pm (21)
    if (day >= 1 && day <= 5) {
      return hour >= 12 && hour < 21;
    }
    
    // Saturday: 9am (9) to 9pm (21)
    if (day === 6) {
      return hour >= 9 && hour < 21;
    }
    
    // Sunday: not knocking hours
    return false;
  }, []);

  // Find competitive callout for Today leaderboard (only during knocking hours)
  const todayCallout = useMemo(() => {
    if (!isKnockingHours || !todayBoard || !currentUserId) return null;

    // Get user's current stats from today's rankings
    const userFP = todayBoard.rankings.fp_plus.find(e => e.userId === currentUserId);
    const userPresentations = todayBoard.rankings.presentations.find(e => e.userId === currentUserId);
    const userTransitions = todayBoard.rankings.transitions.find(e => e.userId === currentUserId);
    const userPitches = todayBoard.rankings.pitches.find(e => e.userId === currentUserId);
    const userDoors = todayBoard.rankings.doors_knocked.find(e => e.userId === currentUserId);

    // Helper to find similar competitor (same value or slightly ahead)
    const findCompetitor = (rankings: typeof todayBoard.rankings.fp_plus, userValue: number, nextMetricRankings?: typeof todayBoard.rankings.fp_plus) => {
      // Find all with same value as user
      const sameValueUsers = rankings.filter(e => e.value === userValue && e.userId !== currentUserId);
      
      if (sameValueUsers.length > 0 && nextMetricRankings) {
        // Use next metric as tiebreaker
        const userNextMetric = nextMetricRankings.find(e => e.userId === currentUserId);
        const userNextValue = userNextMetric?.value || 0;
        
        // Find someone with same primary value but higher secondary value
        const betterNextMetric = sameValueUsers.find(sameUser => {
          const theirNextMetric = nextMetricRankings.find(e => e.userId === sameUser.userId);
          return (theirNextMetric?.value || 0) > userNextValue;
        });
        
        if (betterNextMetric) return betterNextMetric;
      }
      
      // Find next person up (higher value)
      const aheadUsers = rankings.filter(e => e.value > userValue);
      return aheadUsers.length > 0 ? aheadUsers[aheadUsers.length - 1] : null;
    };

    // Tier 1: Has FP+ > 0
    if (userFP && userFP.value > 0) {
      const competitor = findCompetitor(todayBoard.rankings.fp_plus, userFP.value, todayBoard.rankings.presentations);
      if (competitor) {
        const diff = competitor.value - userFP.value;
        const text = diff === 0 
          ? `You and ${competitor.name} are tied at ${userFP.value.toFixed(1)} FP+ today! Race to pull ahead ⚡`
          : `${competitor.name} has ${diff.toFixed(1)} more FP+ than you today! Can you catch up? 💪`;
        return { text, isCurrentUser: false, filterKey: 'today' as const };
      }
      // User is leading
      return { text: `You're leading with ${userFP.value.toFixed(1)} FP+ today! Keep that momentum 🔥`, isCurrentUser: true, filterKey: 'today' as const };
    }

    // Tier 2: Has presentations > 0
    if (userPresentations && userPresentations.value > 0) {
      const competitor = findCompetitor(todayBoard.rankings.presentations, userPresentations.value, todayBoard.rankings.transitions);
      if (competitor) {
        const diff = competitor.value - userPresentations.value;
        const text = diff === 0
          ? `You and ${competitor.name} both have ${userPresentations.value} presentations today! Who closes first? ⚡`
          : `${competitor.name} has ${diff} more presentation${diff > 1 ? 's' : ''} than you today! Catch up 💪`;
        return { text, isCurrentUser: false, filterKey: 'today' as const };
      }
      return { text: `You're leading with ${userPresentations.value} presentation${userPresentations.value > 1 ? 's' : ''} today! 🔥`, isCurrentUser: true, filterKey: 'today' as const };
    }

    // Tier 3: Has transitions > 0
    if (userTransitions && userTransitions.value > 0) {
      const competitor = findCompetitor(todayBoard.rankings.transitions, userTransitions.value, todayBoard.rankings.pitches);
      if (competitor) {
        const diff = competitor.value - userTransitions.value;
        const text = diff === 0
          ? `You and ${competitor.name} both have ${userTransitions.value} transitions today! Push ahead ⚡`
          : `${competitor.name} has ${diff} more transition${diff > 1 ? 's' : ''} than you! Keep going 💪`;
        return { text, isCurrentUser: false, filterKey: 'today' as const };
      }
      return { text: `You're leading with ${userTransitions.value} transition${userTransitions.value > 1 ? 's' : ''} today! 🔥`, isCurrentUser: true, filterKey: 'today' as const };
    }

    // Tier 4: Has pitches > 0
    if (userPitches && userPitches.value > 0) {
      const competitor = findCompetitor(todayBoard.rankings.pitches, userPitches.value, todayBoard.rankings.doors_knocked);
      if (competitor) {
        const diff = competitor.value - userPitches.value;
        const text = diff === 0
          ? `You and ${competitor.name} both have ${userPitches.value} pitches today! Who transitions next? ⚡`
          : `${competitor.name} has ${diff} more pitch${diff > 1 ? 'es' : ''} than you! Catch up 💪`;
        return { text, isCurrentUser: false, filterKey: 'today' as const };
      }
      return { text: `You're leading with ${userPitches.value} pitch${userPitches.value > 1 ? 'es' : ''} today! 🔥`, isCurrentUser: true, filterKey: 'today' as const };
    }

    // Tier 5: Has doors > 0
    if (userDoors && userDoors.value > 0) {
      const competitor = findCompetitor(todayBoard.rankings.doors_knocked, userDoors.value);
      if (competitor) {
        const diff = competitor.value - userDoors.value;
        const text = diff === 0
          ? `You and ${competitor.name} both knocked ${userDoors.value} doors today! Pull ahead ⚡`
          : `${competitor.name} knocked ${diff} more door${diff > 1 ? 's' : ''} than you! Keep knocking 💪`;
        return { text, isCurrentUser: false, filterKey: 'today' as const };
      }
      return { text: `You're the only one knocking today! Set the pace 🏃`, isCurrentUser: true, filterKey: 'today' as const };
    }

    // Tier 6: No activity yet
    const othersWorking = todayBoard.rankings.doors_knocked.length > 0;
    if (othersWorking) {
      const leader = todayBoard.rankings.doors_knocked[0];
      return { text: `${leader.name} already has ${leader.value} doors today! Get out there 🚀`, isCurrentUser: false, filterKey: 'today' as const };
    }

    return null;
  }, [isKnockingHours, todayBoard, currentUserId]);

  // Priority metrics (FP+ > PRMR > Upgrade FP+ > hours > presentations > transitions > latest > earliest > pitches > doors)
  const priorityMetrics = ['mostFP', 'mostPRMR', 'mostUpgradeFP', 'mostHoursWorked', 'mostPresentations', 'mostTransitions', 'latestDoor', 'earliestDoor', 'mostPitches', 'mostDoors'];

  // Find the best available callout based on hierarchy
  const callout = useMemo(() => {
    // Priority 1: Show Today competitive callout if available (only during knocking hours)
    if (todayCallout) return todayCallout;
    const boards = [
      { board: ytdBoard, timeframe: 'year to date', filterKey: 'ytd' as const },
      { board: seasonBoard, timeframe: isSummer ? 'this summer' : 'preseason', filterKey: 'preseason' as const },
      { board: monthlyBoard, timeframe: 'this month', filterKey: 'month' as const },
      { board: weeklyBoard, timeframe: 'this week', filterKey: 'week' as const },
      { board: yesterdayBoard, timeframe: 'yesterday', filterKey: 'yesterday' as const },
    ];

    for (const { board, timeframe, filterKey } of boards) {
      if (!board) continue;

      for (const metric of priorityMetrics) {
        const entry = board[metric as keyof typeof board] as any;
        if (entry && entry.value > 0) {
          const metricLabel = {
            mostFP: 'FP+',
            mostPRMR: 'PRMR',
            mostUpgradeFP: 'upgrade FP+',
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
          if (metric === 'mostPRMR') {
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
                if (metric === 'mostPRMR') {
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
            filterKey,
          };
        }
      }
    }

    return null;
  }, [todayCallout, ytdBoard, yesterdayBoard, weeklyBoard, monthlyBoard, seasonBoard, currentUserId, isSummer, priorityMetrics]);

  if (!callout) return null;

  const handleClick = () => {
    // Dispatch custom event with timeframe
    window.dispatchEvent(new CustomEvent('expandLeaderboard', { 
      detail: { timeframe: callout.filterKey } 
    }));
    onLeaderboardClick?.();
  };

  return (
    <button
      onClick={handleClick}
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
