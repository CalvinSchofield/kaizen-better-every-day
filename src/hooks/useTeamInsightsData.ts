import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DailyEntry {
  user_id: string;
  entry_date: string;
  doors_knocked: number;
  decision_makers: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  fp_plus: number;
  prmr: number;
  upgrade_prmr: number;
  work_start_time: string | null;
  work_end_time: string | null;
  counter_timestamps: any;
  timezone: string | null;
}

interface RepInfo {
  user_id: string;
  name: string;
  year: string;
  teamName?: string;
  mgmtGroupName?: string;
}

interface TeamInsightsData {
  // Totals
  totalDoors: number;
  totalDMs: number;
  totalPitches: number;
  totalTransitions: number;
  totalPresentations: number;
  totalCloses: number;
  totalFP: number;
  totalUpgradeFP: number;
  totalPRMR: number;
  totalUpgradePRMR: number;
  
  // Ratios
  doorsToFp: number;
  doorsToPresentation: number;
  pitchesToFp: number;
  transitionsToFp: number;
  presentationsToClose: number;
  
  // Productivity
  doorsPerHour: number;
  pitchesPerHour: number;
  transitionsPerHour: number;
  presentationsPerHour: number;
  hoursToFp: number;
  
  // Timing
  avgStartTime: string;
  avgEndTime: string;
  mostProductiveHour: string;
  
  // Best periods
  bestDay: { date: string; fp: number; repName: string };
  bestWeek: { startDate: string; fp: number };
  
  // Individual breakdowns
  repBreakdown: Array<{
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
  }>;
}

interface UseTeamInsightsDataParams {
  userIds: string[];
  dateRange: { start: string; end: string };
  excludeUserIds?: string[];
}

const calculateLocalTime = (utcTimestamp: string, timezone: string): { hour: number; minute: number } => {
  const date = new Date(utcTimestamp);
  const localTimeString = date.toLocaleString('en-US', { 
    timeZone: timezone || 'America/Denver',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  const [hourStr, minuteStr] = localTimeString.split(':');
  return { hour: parseInt(hourStr), minute: parseInt(minuteStr) };
};

const timeToDecimal = (hour: number, minute: number): number => {
  return hour + (minute / 60);
};

const decimalToTime = (decimal: number): string => {
  const hour = Math.floor(decimal);
  const minute = Math.round((decimal - hour) * 60);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
};

export const useTeamInsightsData = ({ userIds, dateRange, excludeUserIds = [] }: UseTeamInsightsDataParams) => {
  return useQuery({
    queryKey: ['team-insights', userIds, dateRange, excludeUserIds],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('fetch-team-insights', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          userIds,
          dateRange,
          excludeUserIds,
        },
      });

      if (error) throw error;

      const entries = data.entries as DailyEntry[];
      const reps = data.reps as RepInfo[];

      // Calculate aggregated insights
      const totals = entries.reduce((acc, entry) => ({
        doors: acc.doors + (entry.doors_knocked || 0),
        dms: acc.dms + (entry.decision_makers || 0),
        pitches: acc.pitches + (entry.pitches || 0),
        transitions: acc.transitions + (entry.transitions || 0),
        presentations: acc.presentations + (entry.presentations || 0),
        closes: acc.closes + (entry.closes || 0),
        fp: acc.fp + (entry.fp_plus || 0),
        prmr: acc.prmr + (entry.prmr || 0),
        upgradePRMR: acc.upgradePRMR + (entry.upgrade_prmr || 0),
      }), { doors: 0, dms: 0, pitches: 0, transitions: 0, presentations: 0, closes: 0, fp: 0, prmr: 0, upgradePRMR: 0 });

      const totalUpgradeFP = totals.upgradePRMR / 85;
      const totalNewFP = totals.fp - totalUpgradeFP;

      // Calculate ratios
      const doorsToFp = totals.doors > 0 ? totals.doors / totals.fp : 0;
      const doorsToPresentation = totals.doors > 0 ? totals.doors / totals.presentations : 0;
      const pitchesToFp = totals.pitches > 0 ? totals.pitches / totals.fp : 0;
      const transitionsToFp = totals.transitions > 0 ? totals.transitions / totals.fp : 0;
      const presentationsToClose = totals.presentations > 0 ? totals.presentations / totals.closes : 0;

      // Calculate timing metrics
      const entriesWithTime = entries.filter(e => e.work_start_time && e.work_end_time);
      let totalHours = 0;
      const startTimes: number[] = [];
      const endTimes: number[] = [];
      const hourlyActivity: Record<number, number> = {};

      entriesWithTime.forEach(entry => {
        const start = new Date(entry.work_start_time!);
        const end = new Date(entry.work_end_time!);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        totalHours += hours;

        const timezone = entry.timezone || 'America/Denver';
        const startLocal = calculateLocalTime(entry.work_start_time!, timezone);
        const endLocal = calculateLocalTime(entry.work_end_time!, timezone);
        
        startTimes.push(timeToDecimal(startLocal.hour, startLocal.minute));
        endTimes.push(timeToDecimal(endLocal.hour, endLocal.minute));

        // Track hourly activity
        if (entry.counter_timestamps) {
          const timestamps = Object.values(entry.counter_timestamps).flat() as string[];
          timestamps.forEach(ts => {
            const local = calculateLocalTime(ts, timezone);
            hourlyActivity[local.hour] = (hourlyActivity[local.hour] || 0) + 1;
          });
        }
      });

      const avgStartTime = startTimes.length > 0 
        ? decimalToTime(startTimes.reduce((a, b) => a + b, 0) / startTimes.length)
        : 'N/A';
      
      const avgEndTime = endTimes.length > 0
        ? decimalToTime(endTimes.reduce((a, b) => a + b, 0) / endTimes.length)
        : 'N/A';

      const mostProductiveHourEntry = Object.entries(hourlyActivity)
        .sort(([, a], [, b]) => b - a)[0];
      const mostProductiveHour = mostProductiveHourEntry 
        ? decimalToTime(parseInt(mostProductiveHourEntry[0]))
        : 'N/A';

      // Productivity metrics
      const doorsPerHour = totalHours > 0 ? totals.doors / totalHours : 0;
      const pitchesPerHour = totalHours > 0 ? totals.pitches / totalHours : 0;
      const transitionsPerHour = totalHours > 0 ? totals.transitions / totalHours : 0;
      const presentationsPerHour = totalHours > 0 ? totals.presentations / totalHours : 0;
      const hoursToFp = totals.fp > 0 ? totalHours / totals.fp : 0;

      // Best day
      const dayTotals = entries.reduce((acc, entry) => {
        const date = entry.entry_date;
        if (!acc[date]) {
          acc[date] = { fp: 0, userId: entry.user_id };
        }
        acc[date].fp += entry.fp_plus || 0;
        return acc;
      }, {} as Record<string, { fp: number; userId: string }>);

      const bestDayEntry = Object.entries(dayTotals)
        .sort(([, a], [, b]) => b.fp - a.fp)[0];
      
      const bestDay = bestDayEntry ? {
        date: bestDayEntry[0],
        fp: bestDayEntry[1].fp,
        repName: reps.find(r => r.user_id === bestDayEntry[1].userId)?.name || 'Unknown',
      } : { date: 'N/A', fp: 0, repName: 'N/A' };

      // Best week (Monday-Saturday)
      const bestWeek = { startDate: 'N/A', fp: 0 };

      // Rep breakdown
      const repBreakdown = reps.map(rep => {
        const repEntries = entries.filter(e => e.user_id === rep.user_id);
        const repTotals = repEntries.reduce((acc, e) => ({
          doors: acc.doors + (e.doors_knocked || 0),
          dms: acc.dms + (e.decision_makers || 0),
          pitches: acc.pitches + (e.pitches || 0),
          transitions: acc.transitions + (e.transitions || 0),
          presentations: acc.presentations + (e.presentations || 0),
          closes: acc.closes + (e.closes || 0),
          fp: acc.fp + (e.fp_plus || 0),
          prmr: acc.prmr + (e.prmr || 0),
          upgradePRMR: acc.upgradePRMR + (e.upgrade_prmr || 0),
        }), { doors: 0, dms: 0, pitches: 0, transitions: 0, presentations: 0, closes: 0, fp: 0, prmr: 0, upgradePRMR: 0 });

        const repHours = repEntries.reduce((acc, e) => {
          if (e.work_start_time && e.work_end_time) {
            const start = new Date(e.work_start_time);
            const end = new Date(e.work_end_time);
            return acc + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          }
          return acc;
        }, 0);

        const upgradeFP = repTotals.upgradePRMR / 85;

        return {
          userId: rep.user_id,
          name: rep.name,
          year: rep.year,
          teamName: rep.teamName || 'Unknown Team',
          mgmtGroupName: rep.mgmtGroupName || 'Unknown Group',
          doors: repTotals.doors,
          dms: repTotals.dms,
          pitches: repTotals.pitches,
          transitions: repTotals.transitions,
          presentations: repTotals.presentations,
          closes: repTotals.closes,
          fp: repTotals.fp,
          upgradeFP,
          prmr: repTotals.prmr,
          upgradePRMR: repTotals.upgradePRMR,
          doorsToFpRatio: repTotals.doors > 0 ? repTotals.doors / repTotals.fp : 0,
          hoursWorked: repHours,
        };
      });

      return {
        totalDoors: totals.doors,
        totalDMs: totals.dms,
        totalPitches: totals.pitches,
        totalTransitions: totals.transitions,
        totalPresentations: totals.presentations,
        totalCloses: totals.closes,
        totalFP: totals.fp,
        totalUpgradeFP,
        totalPRMR: totals.prmr,
        totalUpgradePRMR: totals.upgradePRMR,
        doorsToFp,
        doorsToPresentation,
        pitchesToFp,
        transitionsToFp,
        presentationsToClose,
        doorsPerHour,
        pitchesPerHour,
        transitionsPerHour,
        presentationsPerHour,
        hoursToFp,
        avgStartTime,
        avgEndTime,
        mostProductiveHour,
        bestDay,
        bestWeek,
        repBreakdown,
      } as TeamInsightsData;
    },
    enabled: userIds.length > 0,
  });
};
