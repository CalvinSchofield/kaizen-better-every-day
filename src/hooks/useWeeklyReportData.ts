import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, differenceInMinutes } from 'date-fns';
import { WeeklyReportData } from "./useWeeklyReports";

interface UseWeeklyReportDataParams {
  reportType: 'weekly' | 'monthly' | 'blitz';
  periodStart: string;
  periodEnd: string;
  enabled?: boolean;
}

interface RepInfo {
  user_id: string | null;
  name: string;
  year: string;
  team_leader: string | null;
  profile_photo_url: string | null;
  timezone: string | null;
}

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
  break_periods: any;
  timezone: string | null;
}

const calculateLocalTime = (utcTimestamp: string, timezone: string): { hour: number; minute: number } => {
  const date = new Date(utcTimestamp);
  const localTime = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'America/Denver',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).format(date);
  
  const [hour, minute] = localTime.split(':').map(Number);
  return { hour, minute };
};

const timeToDecimal = (hour: number, minute: number): number => {
  return hour + minute / 60;
};

const decimalToTime = (decimal: number): string => {
  const hour = Math.floor(decimal);
  const minute = Math.round((decimal - hour) * 60);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
};

export const useWeeklyReportData = ({ reportType, periodStart, periodEnd, enabled = true }: UseWeeklyReportDataParams) => {
  return useQuery({
    queryKey: ['weekly-report-data', reportType, periodStart, periodEnd],
    enabled: enabled && !!periodStart && !!periodEnd,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<WeeklyReportData> => {
      // Fetch all reps
      const { data: reps, error: repsError } = await supabase
        .from('reps')
        .select('user_id, name, year, team_leader, profile_photo_url, timezone');

      if (repsError) throw repsError;

      const repsWithUsers = (reps || []).filter(r => r.user_id) as RepInfo[];
      const userIds = repsWithUsers.map(r => r.user_id!);
      const repsMap = new Map(repsWithUsers.map(r => [r.user_id!, r]));

      // Fetch entries for current period
      const { data: entries, error: entriesError } = await supabase
        .from('daily_entries')
        .select('*')
        .in('user_id', userIds)
        .gte('entry_date', periodStart)
        .lte('entry_date', periodEnd)
        .eq('is_finalized', true);

      if (entriesError) throw entriesError;

      // Fetch previous period for growth calculation
      const periodStartDate = parseISO(periodStart);
      const periodEndDate = parseISO(periodEnd);
      const periodDays = Math.ceil((periodEndDate.getTime() - periodStartDate.getTime()) / (1000 * 60 * 60 * 24));
      
      let prevPeriodStart: string;
      let prevPeriodEnd: string;
      
      if (reportType === 'weekly') {
        const prevWeekStart = subWeeks(periodStartDate, 1);
        prevPeriodStart = format(prevWeekStart, 'yyyy-MM-dd');
        prevPeriodEnd = format(subWeeks(periodEndDate, 1), 'yyyy-MM-dd');
      } else if (reportType === 'monthly') {
        const prevMonthStart = subMonths(periodStartDate, 1);
        prevPeriodStart = format(prevMonthStart, 'yyyy-MM-dd');
        prevPeriodEnd = format(subMonths(periodEndDate, 1), 'yyyy-MM-dd');
      } else {
        // For blitz, just compare to previous same-length period
        prevPeriodStart = format(new Date(periodStartDate.getTime() - (periodDays + 1) * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
        prevPeriodEnd = format(new Date(periodStartDate.getTime() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
      }

      const { data: prevEntries } = await supabase
        .from('daily_entries')
        .select('*')
        .in('user_id', userIds)
        .gte('entry_date', prevPeriodStart)
        .lte('entry_date', prevPeriodEnd)
        .eq('is_finalized', true);

      // Calculate totals
      const currentTotals = calculateTotals(entries || [], repsMap);
      const prevTotals = calculateTotals(prevEntries || [], repsMap);

      // Calculate growth percentages
      const growth = {
        fp: prevTotals.fp > 0 ? ((currentTotals.fp - prevTotals.fp) / prevTotals.fp) * 100 : 0,
        efp: prevTotals.efp > 0 ? ((currentTotals.efp - prevTotals.efp) / prevTotals.efp) * 100 : 0,
        prmr: prevTotals.prmr > 0 ? ((currentTotals.prmr - prevTotals.prmr) / prevTotals.prmr) * 100 : 0,
        doors: prevTotals.doors > 0 ? ((currentTotals.doors - prevTotals.doors) / prevTotals.doors) * 100 : 0,
        hours: prevTotals.hours > 0 ? ((currentTotals.hours - prevTotals.hours) / prevTotals.hours) * 100 : 0,
      };

      // Calculate per-rep totals
      const repTotals = calculateRepTotals(entries || [], repsMap);

      // Top 10 by class
      const rookies = repTotals.filter(r => r.year === 'Rookie').sort((a, b) => b.fp - a.fp).slice(0, 10);
      const sophomores = repTotals.filter(r => r.year === 'Sophomore').sort((a, b) => b.fp - a.fp).slice(0, 10);
      const vets = repTotals.filter(r => r.year === 'Vet').sort((a, b) => b.fp - a.fp).slice(0, 10);

      // Team rankings
      const teamTotals = calculateTeamTotals(repTotals, repsWithUsers);
      const prevRepTotals = calculateRepTotals(prevEntries || [], repsMap);
      const prevTeamTotals = calculateTeamTotals(prevRepTotals, repsWithUsers);
      
      const teamRankings = teamTotals.map(team => {
        const prevTeam = prevTeamTotals.find(t => t.teamName === team.teamName);
        const growth = prevTeam && prevTeam.fp > 0 
          ? ((team.fp - prevTeam.fp) / prevTeam.fp) * 100 
          : 0;
        return { ...team, growth };
      }).sort((a, b) => b.fp - a.fp);

      // MGMT Group rankings (simplified - group by team leader's leader)
      const mgmtRankings = calculateMgmtTotals(teamTotals);

      // Superlatives
      const superlatives = calculateSuperlatives(entries || [], repsMap, prevRepTotals);

      // Records (placeholder - would need historical data)
      const records = detectRecords(repTotals, teamRankings, currentTotals);

      return {
        officeTotals: currentTotals,
        growth,
        top10Rookies: rookies.map(r => ({
          userId: r.userId,
          name: r.name,
          profilePhotoUrl: r.profilePhotoUrl,
          fp: r.fp,
          efp: r.efp,
        })),
        top10Sophomores: sophomores.map(r => ({
          userId: r.userId,
          name: r.name,
          profilePhotoUrl: r.profilePhotoUrl,
          fp: r.fp,
          efp: r.efp,
        })),
        top10Vets: vets.map(r => ({
          userId: r.userId,
          name: r.name,
          profilePhotoUrl: r.profilePhotoUrl,
          fp: r.fp,
          efp: r.efp,
        })),
        teamRankings,
        mgmtRankings,
        superlatives,
        records,
      };
    },
  });
};

function calculateTotals(entries: DailyEntry[], repsMap: Map<string, RepInfo>) {
  let totalMinutes = 0;
  let startTimes: number[] = [];
  let endTimes: number[] = [];
  const uniqueReps = new Set<string>();
  const uniqueDates = new Set<string>();

  const totals = entries.reduce((acc, entry) => {
    acc.fp += entry.fp_plus || 0;
    acc.prmr += entry.prmr || 0;
    acc.doors += entry.doors_knocked || 0;
    acc.pitches += entry.pitches || 0;
    acc.transitions += entry.transitions || 0;
    acc.presentations += entry.presentations || 0;
    acc.closes += entry.closes || 0;

    uniqueReps.add(entry.user_id);
    uniqueDates.add(entry.entry_date);

    if (entry.work_start_time && entry.work_end_time) {
      const rep = repsMap.get(entry.user_id);
      const timezone = entry.timezone || rep?.timezone || 'America/Denver';
      
      const start = new Date(entry.work_start_time);
      const end = new Date(entry.work_end_time);
      let minutes = differenceInMinutes(end, start);

      if (entry.break_periods && Array.isArray(entry.break_periods)) {
        entry.break_periods.forEach((bp: any) => {
          const breakStart = new Date(bp.start);
          const breakEnd = new Date(bp.end);
          minutes -= differenceInMinutes(breakEnd, breakStart);
        });
      }

      totalMinutes += minutes;

      const startTime = calculateLocalTime(entry.work_start_time, timezone);
      const endTime = calculateLocalTime(entry.work_end_time, timezone);
      startTimes.push(timeToDecimal(startTime.hour, startTime.minute));
      endTimes.push(timeToDecimal(endTime.hour, endTime.minute));
    }

    return acc;
  }, { fp: 0, prmr: 0, doors: 0, pitches: 0, transitions: 0, presentations: 0, closes: 0 });

  const efp = totals.prmr / 85;
  const hours = totalMinutes / 60;
  const avgStartTime = startTimes.length > 0 
    ? decimalToTime(startTimes.reduce((a, b) => a + b, 0) / startTimes.length)
    : 'N/A';
  const avgEndTime = endTimes.length > 0 
    ? decimalToTime(endTimes.reduce((a, b) => a + b, 0) / endTimes.length)
    : 'N/A';

  return {
    ...totals,
    efp,
    hours,
    avgStartTime,
    avgEndTime,
    daysWorked: uniqueDates.size,
    uniqueReps: uniqueReps.size,
  };
}

function calculateRepTotals(entries: DailyEntry[], repsMap: Map<string, RepInfo>) {
  const repMap = new Map<string, {
    userId: string;
    name: string;
    year: string;
    profilePhotoUrl?: string;
    teamLeader?: string;
    fp: number;
    efp: number;
    prmr: number;
    doors: number;
    hours: number;
    avgEndTime: number;
    avgStartTime: number;
    endTimeCount: number;
    startTimeCount: number;
  }>();

  entries.forEach(entry => {
    const rep = repsMap.get(entry.user_id);
    if (!rep) return;

    const existing = repMap.get(entry.user_id) || {
      userId: entry.user_id,
      name: rep.name,
      year: rep.year || 'Rookie',
      profilePhotoUrl: rep.profile_photo_url || undefined,
      teamLeader: rep.team_leader || undefined,
      fp: 0,
      efp: 0,
      prmr: 0,
      doors: 0,
      hours: 0,
      avgEndTime: 0,
      avgStartTime: 0,
      endTimeCount: 0,
      startTimeCount: 0,
    };

    existing.fp += entry.fp_plus || 0;
    existing.prmr += entry.prmr || 0;
    existing.doors += entry.doors_knocked || 0;

    if (entry.work_start_time && entry.work_end_time) {
      const timezone = entry.timezone || rep.timezone || 'America/Denver';
      const start = new Date(entry.work_start_time);
      const end = new Date(entry.work_end_time);
      let minutes = differenceInMinutes(end, start);

      if (entry.break_periods && Array.isArray(entry.break_periods)) {
        entry.break_periods.forEach((bp: any) => {
          const breakStart = new Date(bp.start);
          const breakEnd = new Date(bp.end);
          minutes -= differenceInMinutes(breakEnd, breakStart);
        });
      }

      existing.hours += minutes / 60;

      const startTime = calculateLocalTime(entry.work_start_time, timezone);
      const endTime = calculateLocalTime(entry.work_end_time, timezone);
      existing.avgStartTime += timeToDecimal(startTime.hour, startTime.minute);
      existing.avgEndTime += timeToDecimal(endTime.hour, endTime.minute);
      existing.startTimeCount++;
      existing.endTimeCount++;
    }

    repMap.set(entry.user_id, existing);
  });

  return Array.from(repMap.values()).map(r => ({
    ...r,
    efp: r.prmr / 85,
    avgStartTime: r.startTimeCount > 0 ? r.avgStartTime / r.startTimeCount : 0,
    avgEndTime: r.endTimeCount > 0 ? r.avgEndTime / r.endTimeCount : 0,
  }));
}

function calculateTeamTotals(repTotals: ReturnType<typeof calculateRepTotals>, reps: RepInfo[]) {
  const teamMap = new Map<string, {
    teamName: string;
    leadName: string;
    leadPhoto?: string;
    fp: number;
    efp: number;
  }>();

  repTotals.forEach(rep => {
    const teamLeader = rep.teamLeader || 'Unknown Team';
    const existing = teamMap.get(teamLeader) || {
      teamName: teamLeader,
      leadName: teamLeader,
      fp: 0,
      efp: 0,
    };

    existing.fp += rep.fp;
    existing.efp += rep.efp;

    // Try to find lead photo
    const leadRep = reps.find(r => r.name === teamLeader);
    if (leadRep?.profile_photo_url) {
      existing.leadPhoto = leadRep.profile_photo_url;
    }

    teamMap.set(teamLeader, existing);
  });

  return Array.from(teamMap.values());
}

function calculateMgmtTotals(teamTotals: ReturnType<typeof calculateTeamTotals>) {
  // For now, treat all teams as one office group
  // In a real implementation, you'd have MGMT group mappings
  const totalFp = teamTotals.reduce((sum, t) => sum + t.fp, 0);
  const totalEfp = teamTotals.reduce((sum, t) => sum + t.efp, 0);

  return [{
    mgmtGroupName: 'Office',
    leadName: 'Area Director',
    fp: totalFp,
    efp: totalEfp,
    growth: 0,
  }];
}

function calculateSuperlatives(
  entries: DailyEntry[], 
  repsMap: Map<string, RepInfo>,
  prevRepTotals: ReturnType<typeof calculateRepTotals>
) {
  const repTotals = calculateRepTotals(entries, repsMap);
  const prevTotalsMap = new Map(prevRepTotals.map(r => [r.userId, r]));

  // Late Night Assassin - latest avg end time
  const lateNightReps = repTotals.filter(r => r.endTimeCount > 0).sort((a, b) => b.avgEndTime - a.avgEndTime);
  const lateNightAssassin = lateNightReps[0] ? {
    name: lateNightReps[0].name,
    photo: lateNightReps[0].profilePhotoUrl,
    value: decimalToTime(lateNightReps[0].avgEndTime),
    stat: 'Avg end time',
  } : undefined;

  // Early Deals Bandit - earliest avg start time
  const earlyBirdReps = repTotals.filter(r => r.startTimeCount > 0).sort((a, b) => a.avgStartTime - b.avgStartTime);
  const earlyDealsBandit = earlyBirdReps[0] ? {
    name: earlyBirdReps[0].name,
    photo: earlyBirdReps[0].profilePhotoUrl,
    value: decimalToTime(earlyBirdReps[0].avgStartTime),
    stat: 'Avg start time',
  } : undefined;

  // The Hustler - most hours worked
  const hustlerReps = repTotals.sort((a, b) => b.hours - a.hours);
  const theHustler = hustlerReps[0] && hustlerReps[0].hours > 0 ? {
    name: hustlerReps[0].name,
    photo: hustlerReps[0].profilePhotoUrl,
    value: `${hustlerReps[0].hours.toFixed(1)} hrs`,
    stat: 'Total hours',
  } : undefined;

  // Most Efficient - best FP+ per door
  const efficientReps = repTotals.filter(r => r.doors >= 50).map(r => ({
    ...r,
    efficiency: r.doors > 0 ? r.fp / r.doors : 0,
  })).sort((a, b) => b.efficiency - a.efficiency);
  const mostEfficient = efficientReps[0] ? {
    name: efficientReps[0].name,
    photo: efficientReps[0].profilePhotoUrl,
    value: `${(efficientReps[0].efficiency * 100).toFixed(1)}%`,
    stat: 'FP+ per door',
  } : undefined;

  // Most Improved - biggest growth vs previous period
  const improvedReps = repTotals.map(r => {
    const prev = prevTotalsMap.get(r.userId);
    const growth = prev && prev.fp > 0 ? ((r.fp - prev.fp) / prev.fp) * 100 : 0;
    return { ...r, growth };
  }).filter(r => r.growth > 0).sort((a, b) => b.growth - a.growth);
  const mostImproved = improvedReps[0] ? {
    name: improvedReps[0].name,
    photo: improvedReps[0].profilePhotoUrl,
    value: `+${improvedReps[0].growth.toFixed(0)}%`,
    stat: 'FP+ growth',
  } : undefined;

  // The Closer - best presentations to close ratio (not used since we track FP+)
  // Door Destroyer - most doors knocked
  const doorReps = repTotals.sort((a, b) => b.doors - a.doors);
  const doorDestroyer = doorReps[0] && doorReps[0].doors > 0 ? {
    name: doorReps[0].name,
    photo: doorReps[0].profilePhotoUrl,
    value: `${doorReps[0].doors}`,
    stat: 'Doors knocked',
  } : undefined;

  return {
    lateNightAssassin,
    earlyDealsBandit,
    theHustler,
    mostEfficient,
    mostImproved,
    doorDestroyer,
  };
}

function detectRecords(
  repTotals: ReturnType<typeof calculateRepTotals>,
  teamRankings: ReturnType<typeof calculateTeamTotals>,
  officeTotals: ReturnType<typeof calculateTotals>
) {
  // In a real implementation, you'd compare against historical records
  // For now, just flag top performers
  const records: WeeklyReportData['records'] = [];

  // Top individual FP+
  const topRep = repTotals.sort((a, b) => b.fp - a.fp)[0];
  if (topRep && topRep.fp >= 10) {
    records.push({
      type: 'individual',
      category: 'Highest FP+',
      holder: topRep.name,
      value: topRep.fp,
    });
  }

  // Top team
  const topTeam = teamRankings[0];
  if (topTeam && topTeam.fp >= 20) {
    records.push({
      type: 'team',
      category: 'Team FP+',
      holder: topTeam.teamName,
      value: topTeam.fp,
    });
  }

  return records;
}
