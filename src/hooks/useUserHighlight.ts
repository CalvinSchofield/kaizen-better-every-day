import { useMemo } from "react";
import { useYTDLeaderboard } from "./useYTDLeaderboard";
import { useSeasonLeaderboard } from "./useSeasonLeaderboard";
import { useMonthlyLeaderboard } from "./useMonthlyLeaderboard";
import { useWeeklyLeaderboard } from "./useWeeklyLeaderboard";
import { useYesterdayLeaderboard } from "./useYesterdayLeaderboard";

export interface UserHighlight {
  metric: string;
  timeframe: string;
  isLeading: boolean;
  name?: string;
  value?: string;
}

export const useUserHighlight = (userId: string | null, filterByYear?: string) => {
  const { data: ytdBoard } = useYTDLeaderboard(filterByYear);
  const { data: seasonBoard } = useSeasonLeaderboard(filterByYear);
  const { data: monthlyBoard } = useMonthlyLeaderboard(filterByYear);
  const { data: weeklyBoard } = useWeeklyLeaderboard(filterByYear);
  const { data: yesterdayBoard } = useYesterdayLeaderboard(filterByYear);

  const highlight = useMemo((): UserHighlight | null => {
    if (!userId) return null;

    const priorityMetrics = [
      { key: 'mostFP', label: 'FP+' },
      { key: 'mostPRMR', label: 'PRMR' },
      { key: 'mostUpgradeFP', label: 'Upgrade FP+' },
      { key: 'mostHoursWorked', label: 'Hours Worked' },
      { key: 'mostPresentations', label: 'Presentations' },
      { key: 'mostTransitions', label: 'Transitions' },
      { key: 'latestDoor', label: 'Latest Door' },
      { key: 'earliestDoor', label: 'Earliest Door' },
      { key: 'mostPitches', label: 'Pitches' },
      { key: 'mostDoors', label: 'Doors' },
      { key: 'mostDecisionMakers', label: 'DMs' },
    ];

    const boards = [
      { board: ytdBoard, timeframe: 'this year' },
      { board: seasonBoard, timeframe: 'this season' },
      { board: monthlyBoard, timeframe: 'this month' },
      { board: weeklyBoard, timeframe: 'this week' },
      { board: yesterdayBoard, timeframe: 'yesterday' },
    ];

    // Find first match where user is leading
    for (const { board, timeframe } of boards) {
      if (!board) continue;
      for (const { key, label } of priorityMetrics) {
        const entry = board[key as keyof typeof board] as any;
        if (entry?.userId === userId && entry.value > 0) {
          return { metric: label, timeframe, isLeading: true };
        }
      }
    }

    // Fallback: show top FP+ leader
    for (const { board, timeframe } of boards) {
      if (!board) continue;
      const fpEntry = board.mostFP as any;
      if (fpEntry?.value > 0) {
        const isTimeMetric = false;
        const value = isTimeMetric ? fpEntry.timeValue : `${fpEntry.value.toFixed(1)} FP+`;
        return {
          metric: 'FP+',
          timeframe,
          isLeading: false,
          name: fpEntry.name,
          value
        };
      }
    }

    return null;
  }, [userId, ytdBoard, seasonBoard, monthlyBoard, weeklyBoard, yesterdayBoard]);

  return highlight;
};
