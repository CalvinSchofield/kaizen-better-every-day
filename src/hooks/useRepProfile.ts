import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateFromSalesLog } from '@/utils/salesLogCalculations';

const SEASON_START = '2025-09-28';

interface RecordEntry { value: number; date: string }

interface RepProfileData {
  name: string;
  year: string | null;
  profilePhotoUrl: string | null;
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

      // Fetch rep info, daily entries, records, and efp mode in parallel
      const [repResult, entriesResult, recordsResult, lastActiveResult] = await Promise.all([
        supabase
          .from('reps')
          .select('name, year, profile_photo_url, team_leader, recruiter, efp_mode_enabled')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('daily_entries')
          .select('entry_date, fp_plus, prmr, sales_log, doors_knocked, presentations, transitions, upgrade_prmr')
          .eq('user_id', userId)
          .gte('entry_date', SEASON_START)
          .eq('is_finalized', true),
        supabase
          .from('personal_records')
          .select('record_type, value, entry_date')
          .eq('user_id', userId)
          .in('record_type', ['daily_fp', 'weekly_fp', 'monthly_fp', 'daily_prmr', 'weekly_prmr', 'monthly_prmr']),
        supabase
          .from('daily_entries')
          .select('updated_at')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

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

      // Parse personal records
      const records = recordsResult.data || [];
      const getRecord = (type: string) => {
        const r = records.find(rec => rec.record_type === type);
        return r ? { value: Number(r.value), date: r.entry_date } : null;
      };

      return {
        name: rep.name,
        year: rep.year,
        profilePhotoUrl: rep.profile_photo_url,
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
        bestDayFp: getRecord('daily_fp'),
        bestWeekFp: getRecord('weekly_fp'),
        bestMonthFp: getRecord('monthly_fp'),
        bestDayPrmr: getRecord('daily_prmr'),
        bestWeekPrmr: getRecord('weekly_prmr'),
        bestMonthPrmr: getRecord('monthly_prmr'),
        dailyFpValues,
        efpModeEnabled,
        lastActiveAt: lastActiveResult.data?.updated_at || null,
      };
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
};
