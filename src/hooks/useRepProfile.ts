import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateFromSalesLog } from '@/utils/salesLogCalculations';
import { withTimeout } from '@/utils/withTimeout';
import { startOfWeek, startOfMonth, format } from 'date-fns';

const SEASON_START = '2025-09-28';

interface RecordEntry { value: number; date: string }

/** Given daily values, compute the best single day, best week sum, best month sum */
function computeBestRecords(dailyValues: { date: string; value: number }[]): {
  bestDay: RecordEntry | null;
  bestWeek: RecordEntry | null;
  bestMonth: RecordEntry | null;
} {
  if (!dailyValues || dailyValues.length === 0) return { bestDay: null, bestWeek: null, bestMonth: null };

  // Best day
  let bestDay: RecordEntry | null = null;
  for (const d of dailyValues) {
    const v = Number(d.value) || 0;
    if (v > 0 && (!bestDay || v > bestDay.value)) {
      bestDay = { value: v, date: d.date };
    }
  }

  // Best week (ISO week, Mon-Sun)
  const weekBuckets = new Map<string, { total: number; startDate: string }>();
  for (const d of dailyValues) {
    const v = Number(d.value) || 0;
    if (v <= 0) continue;
    try {
      const weekStart = format(startOfWeek(new Date(d.date + 'T12:00:00'), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const existing = weekBuckets.get(weekStart);
      if (existing) {
        existing.total += v;
      } else {
        weekBuckets.set(weekStart, { total: v, startDate: weekStart });
      }
    } catch { /* skip invalid dates */ }
  }
  let bestWeek: RecordEntry | null = null;
  for (const [, bucket] of weekBuckets) {
    if (bucket.total > 0 && (!bestWeek || bucket.total > bestWeek.value)) {
      bestWeek = { value: bucket.total, date: bucket.startDate };
    }
  }

  // Best month
  const monthBuckets = new Map<string, { total: number; startDate: string }>();
  for (const d of dailyValues) {
    const v = Number(d.value) || 0;
    if (v <= 0) continue;
    try {
      const monthStart = format(startOfMonth(new Date(d.date + 'T12:00:00')), 'yyyy-MM-dd');
      const existing = monthBuckets.get(monthStart);
      if (existing) {
        existing.total += v;
      } else {
        monthBuckets.set(monthStart, { total: v, startDate: monthStart });
      }
    } catch { /* skip invalid dates */ }
  }
  let bestMonth: RecordEntry | null = null;
  for (const [, bucket] of monthBuckets) {
    if (bucket.total > 0 && (!bestMonth || bucket.total > bestMonth.value)) {
      bestMonth = { value: bucket.total, date: bucket.startDate };
    }
  }

  return { bestDay, bestWeek, bestMonth };
}

interface RepProfileData {
  name: string;
  year: string | null;
  profilePhotoUrl: string | null;
  phone: string | null;
  teamLeader: string | null;
  recruiter: string | null;
  teamName: string | null;
  officeName: string | null;
  ytdFpPlus: number;
  ytdPrmr: number;
  ytdUpgradeFpPlus: number;
  ytdDoors: number;
  ytdPresentations: number;
  ytdTransitions: number;
  bestDayFp: RecordEntry | null;
  bestWeekFp: RecordEntry | null;
  bestMonthFp: RecordEntry | null;
  bestDayPrmr: RecordEntry | null;
  bestWeekPrmr: RecordEntry | null;
  bestMonthPrmr: RecordEntry | null;
  dailyFpValues: { date: string; fp: number; prmr: number }[];
  efpModeEnabled: boolean;
  /** ISO timestamp of last activity (most recent daily entry updated_at) */
  lastActiveAt: string | null;
}

export const useRepProfile = (userId: string | null) => {
  return useQuery({
    queryKey: ['rep-profile', userId],
    queryFn: async (): Promise<RepProfileData | null> => {
      if (!userId) return null;

      // Fetch rep info and daily entries in parallel with a safety timeout
      const PROFILE_TIMEOUT_MS = 8000;
      const fetchData = Promise.all([
          supabase
            .from('reps')
            .select('name, year, profile_photo_url, phone, team_leader, recruiter, efp_mode_enabled, updated_at')
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('daily_entries')
            .select('entry_date, fp_plus, prmr, sales_log, doors_knocked, presentations, transitions, upgrade_prmr')
            .eq('user_id', userId)
            .gte('entry_date', SEASON_START),
      ]);

      const [repResult, entriesResult] = await withTimeout(
        fetchData,
        PROFILE_TIMEOUT_MS,
        'Profile load timeout'
      );

      if (repResult.error) throw repResult.error;
      if (entriesResult.error) throw entriesResult.error;

      const rep = repResult.data;
      if (!rep) return null;
      const efpModeEnabled = rep.efp_mode_enabled ?? false;

      // Get team name from team_leader match
      let teamName: string | null = null;
      if (rep.team_leader) {
        const { data: team } = await supabase
          .from('teams')
          .select('name')
          .eq('name', rep.team_leader)
          .maybeSingle();
        
        if (!team) {
          // Try matching by lead_user_id's rep name
          teamName = rep.team_leader;
        } else {
          teamName = team.name;
        }
      }

      // Aggregate YTD stats from daily entries
      const entries = entriesResult.data || [];
      let ytdFpPlus = 0;
      let ytdPrmr = 0;
      let ytdUpgradePrmr = 0;
      let ytdDoors = 0;
      let ytdPresentations = 0;
      let ytdTransitions = 0;

      // Sort entries chronologically for sparkline
      const sortedEntries = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
      const dailyFpValues: { date: string; fp: number; prmr: number }[] = [];

      for (const entry of sortedEntries) {
        const salesLog = entry.sales_log as any[] | null;
      let dayFp = 0;
        let dayPrmr = 0;
        if (salesLog && Array.isArray(salesLog) && salesLog.length > 0) {
          const calc = calculateFromSalesLog(salesLog);
          dayFp = calc.fp;
          dayPrmr = calc.prmr;
          ytdFpPlus += calc.fp;
          ytdPrmr += calc.prmr;
          const upgradePrmr = salesLog
            .filter(s => s.type === 'upgrade' && s.install_status !== 'never_installed')
            .reduce((sum: number, s: any) => sum + (Number(s.prmr) || 0), 0);
          ytdUpgradePrmr += upgradePrmr;
        } else {
          dayFp = entry.fp_plus || 0;
          dayPrmr = entry.prmr || 0;
          ytdFpPlus += entry.fp_plus || 0;
          ytdPrmr += entry.prmr || 0;
          ytdUpgradePrmr += entry.upgrade_prmr || 0;
        }
        const fpValue = Math.round(dayFp * 10) / 10;
        const prmrValue = Math.round(dayPrmr);
        dailyFpValues.push({ 
          date: entry.entry_date, 
          fp: fpValue,
          prmr: prmrValue,
        });
        ytdDoors += entry.doors_knocked || 0;
        ytdPresentations += entry.presentations || 0;
        ytdTransitions += entry.transitions || 0;
      }

      // Compute best records from daily data (source of truth)
      const fpDailyValues = dailyFpValues.map(d => ({ date: d.date, value: d.fp }));
      const prmrDailyValues = dailyFpValues.map(d => ({ date: d.date, value: d.prmr }));
      const fpRecords = computeBestRecords(fpDailyValues);
      const prmrRecords = computeBestRecords(prmrDailyValues);

      return {
        name: rep.name,
        year: rep.year,
        profilePhotoUrl: rep.profile_photo_url,
        phone: rep.phone || null,
        teamLeader: rep.team_leader,
        recruiter: rep.recruiter,
        teamName: teamName || rep.team_leader,
        officeName: 'Yosemite 2026',
        ytdFpPlus,
        ytdPrmr,
        ytdUpgradeFpPlus: ytdUpgradePrmr / 85,
        ytdDoors,
        ytdPresentations,
        ytdTransitions,
        bestDayFp: fpRecords.bestDay,
        bestWeekFp: fpRecords.bestWeek,
        bestMonthFp: fpRecords.bestMonth,
        bestDayPrmr: prmrRecords.bestDay,
        bestWeekPrmr: prmrRecords.bestWeek,
        bestMonthPrmr: prmrRecords.bestMonth,
        dailyFpValues,
        efpModeEnabled,
        lastActiveAt: rep.updated_at || null,
      };
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    retryDelay: 2000,
  });
};
