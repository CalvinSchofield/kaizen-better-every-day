import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Incentive, IncentiveMetric, IncentiveTargetType } from './useIncentives';
import { getCleanFirstName } from '@/utils/nameUtils';
import { SingleDayRecapData, RecapMoment as IntraDayMoment } from './useSingleDayRecap';
import { formatInTimeZone } from 'date-fns-tz';
import { format, parseISO } from 'date-fns';

export interface IncentiveRecapDay {
  date: string;
  dayNumber: number;
  values: Record<string, number>;
  cumulative: Record<string, number>;
  groupTotal?: number;
  leader: string | null;
}

export interface IncentiveRecapMoment {
  dayNumber: number;
  date: string;
  type: 'first_score' | 'lead_change' | 'biggest_day' | 'final' | 'milestone' | 'qualified';
  narrative: string;
  userId?: string;
  value?: number;
}

export interface IncentiveRecapStats {
  duration: number;
  margin: number;
  leadChanges: number;
  bestDay: { userId: string; name: string; value: number; dayNumber: number } | null;
  qualifiedCount?: number;
  groupTotal?: number;
  targetValue?: number;
}

export interface IncentiveRecapData {
  days: IncentiveRecapDay[];
  moments: IncentiveRecapMoment[];
  stats: IncentiveRecapStats;
  participantNames: Record<string, string>;
  intraDayData?: SingleDayRecapData | null;
}

const metricColumn: Record<IncentiveMetric, string> = {
  fp_plus: 'fp_plus',
  prmr: 'prmr',
  transitions: 'transitions',
  doors_knocked: 'doors_knocked',
};

function fmtTime(isoStr: string, tz: string): string {
  try {
    return formatInTimeZone(new Date(isoStr), tz, 'h:mm a');
  } catch {
    try { return format(parseISO(isoStr), 'h:mm a'); } catch { return ''; }
  }
}

async function fetchIntraDayData(
  userIds: string[],
  dateStr: string,
  metric: IncentiveMetric,
  participantNames: Record<string, string>,
): Promise<SingleDayRecapData | null> {
  const { data: entries } = await supabase
    .from('daily_entries')
    .select('user_id, counter_timestamps, sales_log, timezone, work_start_time')
    .in('user_id', userIds)
    .eq('entry_date', dateStr);

  if (!entries || entries.length === 0) return null;

  const moments: IntraDayMoment[] = [];
  const runningScore: Record<string, number> = {};
  userIds.forEach(uid => { runningScore[uid] = 0; });

  for (const entry of entries) {
    const uid = entry.user_id;
    const name = participantNames[uid] || 'Unknown';
    const tz = entry.timezone || 'America/New_York';
    const timestamps = entry.counter_timestamps as Record<string, string[]> | null;
    const salesLog = (entry.sales_log as any[] | null) || [];

    const doors = (timestamps?.doors_knocked || []).map(ts => ({ time: new Date(ts), ts }));
    const transitions = (timestamps?.transitions || []).map(ts => ({ time: new Date(ts), ts }));
    const closes = (timestamps?.closes || []).map(ts => ({ time: new Date(ts), ts }));
    const sales = salesLog
      .filter(s => s.timestamp && s.install_status !== 'never_installed')
      .map(s => ({
        time: new Date(s.timestamp),
        ts: s.timestamp as string,
        prmr: Number(s.prmr) || 0,
        type: s.type as string,
      }));

    const coveredCloses = new Set<number>();
    sales.forEach(sale => {
      closes.forEach((c, ci) => {
        if (Math.abs(sale.time.getTime() - c.time.getTime()) < 5 * 60 * 1000) {
          coveredCloses.add(ci);
        }
      });
    });

    const coveredTransitions = new Set<number>();
    closes.forEach(c => {
      transitions.forEach((t, ti) => {
        if (c.time.getTime() - t.time.getTime() > 0 && c.time.getTime() - t.time.getTime() < 60 * 60 * 1000) {
          coveredTransitions.add(ti);
        }
      });
    });

    if (metric === 'fp_plus' || metric === 'prmr') {
      sales.forEach(sale => {
        const isFP = sale.type === 'fp';
        const scoreInc = metric === 'prmr' ? sale.prmr : 1;
        runningScore[uid] += scoreInc;
        moments.push({
          time: sale.time, timeStr: fmtTime(sale.ts, tz), userId: uid, userName: name,
          type: 'sale',
          label: isFP ? `Sold — $${sale.prmr.toLocaleString()}` : `Upgrade — $${sale.prmr.toLocaleString()}`,
          emoji: '💰', value: sale.prmr, runningScore: { ...runningScore },
        });
      });
      closes.forEach((c, ci) => {
        if (coveredCloses.has(ci)) return;
        moments.push({
          time: c.time, timeStr: fmtTime(c.ts, tz), userId: uid, userName: name,
          type: 'close', label: 'Close (no sale logged)', emoji: '✅', runningScore: { ...runningScore },
        });
      });
      const orphanTransitions = transitions.filter((_, ti) => !coveredTransitions.has(ti));
      orphanTransitions.forEach(t => {
        moments.push({
          time: t.time, timeStr: fmtTime(t.ts, tz), userId: uid, userName: name,
          type: 'transition', label: 'Transition', emoji: '🔄', runningScore: { ...runningScore },
        });
      });
      if (doors.length > 0) batchDoors(doors, uid, name, tz, moments, runningScore);
    } else if (metric === 'transitions') {
      transitions.forEach(t => {
        runningScore[uid] += 1;
        moments.push({
          time: t.time, timeStr: fmtTime(t.ts, tz), userId: uid, userName: name,
          type: 'transition', label: 'Transition', emoji: '🔄', runningScore: { ...runningScore },
        });
      });
      if (doors.length > 0) batchDoors(doors, uid, name, tz, moments, runningScore);
    } else if (metric === 'doors_knocked') {
      if (doors.length > 0) batchDoorsWithScore(doors, uid, name, tz, moments, runningScore);
    }

    if (entry.work_start_time) {
      moments.push({
        time: new Date(entry.work_start_time), timeStr: fmtTime(entry.work_start_time, tz),
        userId: uid, userName: name, type: 'started', label: 'Started knocking',
        emoji: '🏁', runningScore: { ...runningScore },
      });
    }
  }

  moments.sort((a, b) => a.time.getTime() - b.time.getTime());

  // Recompute running scores
  const metricRunning: Record<string, number> = {};
  userIds.forEach(uid => { metricRunning[uid] = 0; });
  for (const m of moments) {
    if (m.type === 'sale' && (metric === 'fp_plus' || metric === 'prmr')) {
      metricRunning[m.userId] += metric === 'prmr' ? (m.value || 0) : 1;
    } else if (m.type === 'transition' && metric === 'transitions') {
      metricRunning[m.userId] += 1;
    } else if (m.type === 'door_batch' && metric === 'doors_knocked') {
      metricRunning[m.userId] += m.value || 0;
    }
    m.runningScore = { ...metricRunning };
  }

  const firstMoment = moments.find(m => m.type !== 'started');

  return {
    moments,
    participantNames,
    summary: {
      totalEvents: moments.length,
      firstActivity: firstMoment ? { userId: firstMoment.userId, timeStr: firstMoment.timeStr } : null,
    },
  };
}

function batchDoors(
  doors: { time: Date; ts: string }[], uid: string, name: string, tz: string,
  moments: IntraDayMoment[], runningScore: Record<string, number>,
) {
  const WINDOW_MS = 60 * 60 * 1000;
  const sorted = [...doors].sort((a, b) => a.time.getTime() - b.time.getTime());
  let batchStart = sorted[0].time.getTime();
  let batchCount = 0;
  let batchFirstTs = sorted[0].ts;

  for (let i = 0; i < sorted.length; i++) {
    const d = sorted[i];
    if (d.time.getTime() - batchStart > WINDOW_MS) {
      moments.push({
        time: new Date(batchStart), timeStr: fmtTime(batchFirstTs, tz), userId: uid, userName: name,
        type: 'door_batch', label: `Knocked ${batchCount} door${batchCount !== 1 ? 's' : ''}`,
        emoji: '🚪', value: batchCount, runningScore: { ...runningScore },
      });
      batchStart = d.time.getTime(); batchCount = 1; batchFirstTs = d.ts;
    } else { batchCount++; }
  }
  if (batchCount > 0) {
    moments.push({
      time: new Date(batchStart), timeStr: fmtTime(batchFirstTs, tz), userId: uid, userName: name,
      type: 'door_batch', label: `Knocked ${batchCount} door${batchCount !== 1 ? 's' : ''}`,
      emoji: '🚪', value: batchCount, runningScore: { ...runningScore },
    });
  }
}

function batchDoorsWithScore(
  doors: { time: Date; ts: string }[], uid: string, name: string, tz: string,
  moments: IntraDayMoment[], runningScore: Record<string, number>,
) {
  const WINDOW_MS = 60 * 60 * 1000;
  const sorted = [...doors].sort((a, b) => a.time.getTime() - b.time.getTime());
  let batchStart = sorted[0].time.getTime();
  let batchCount = 0;
  let batchFirstTs = sorted[0].ts;

  for (let i = 0; i < sorted.length; i++) {
    const d = sorted[i];
    if (d.time.getTime() - batchStart > WINDOW_MS) {
      runningScore[uid] += batchCount;
      moments.push({
        time: new Date(batchStart), timeStr: fmtTime(batchFirstTs, tz), userId: uid, userName: name,
        type: 'door_batch', label: `Knocked ${batchCount} door${batchCount !== 1 ? 's' : ''}`,
        emoji: '🚪', value: batchCount, runningScore: { ...runningScore },
      });
      batchStart = d.time.getTime(); batchCount = 1; batchFirstTs = d.ts;
    } else { batchCount++; }
  }
  if (batchCount > 0) {
    runningScore[uid] += batchCount;
    moments.push({
      time: new Date(batchStart), timeStr: fmtTime(batchFirstTs, tz), userId: uid, userName: name,
      type: 'door_batch', label: `Knocked ${batchCount} door${batchCount !== 1 ? 's' : ''}`,
      emoji: '🚪', value: batchCount, runningScore: { ...runningScore },
    });
  }
}

async function fetchIncentiveRecap(incentive: Incentive): Promise<IncentiveRecapData | null> {
  const eligibleReps = incentive.eligible_reps || [];
  if (eligibleReps.length === 0) return null;

  const userIds = eligibleReps.map(r => r.user_id);
  const col = metricColumn[incentive.metric];
  const isSingleDay = incentive.start_date === incentive.end_date;

  const participantNames: Record<string, string> = {};
  eligibleReps.forEach(r => {
    participantNames[r.user_id] = getCleanFirstName(r.rep_name) || 'Unknown';
  });

  // Fetch intra-day data for single-day incentives
  let intraDayData: SingleDayRecapData | null = null;
  if (isSingleDay) {
    intraDayData = await fetchIntraDayData(userIds, incentive.start_date, incentive.metric, participantNames);
  }

  // Fetch daily entries for multi-day recap
  const { data: entries } = await supabase
    .from('daily_entries')
    .select('user_id, entry_date, fp_plus, prmr, transitions, doors_knocked')
    .in('user_id', userIds)
    .gte('entry_date', incentive.start_date)
    .lte('entry_date', incentive.end_date)
    .order('entry_date', { ascending: true });

  if (!entries) return null;

  // Build day-by-day data
  const startDate = new Date(incentive.start_date + 'T00:00:00');
  const endDate = new Date(incentive.end_date + 'T00:00:00');
  const days: IncentiveRecapDay[] = [];
  const cumulative: Record<string, number> = {};
  userIds.forEach(id => { cumulative[id] = 0; });

  let dayNumber = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    dayNumber++;
    const dateStr = d.toISOString().split('T')[0];
    const dayValues: Record<string, number> = {};

    userIds.forEach(uid => {
      const entry = entries.find(e => e.user_id === uid && e.entry_date === dateStr);
      const val = entry ? Number(entry[col as keyof typeof entry]) || 0 : 0;
      dayValues[uid] = val;
      cumulative[uid] += val;
    });

    let leader: string | null = null;
    let maxVal = 0;
    let tied = false;
    userIds.forEach(uid => {
      if (cumulative[uid] > maxVal) { maxVal = cumulative[uid]; leader = uid; tied = false; }
      else if (cumulative[uid] === maxVal && cumulative[uid] > 0) { tied = true; }
    });
    if (tied) leader = null;

    const groupTotal = userIds.reduce((sum, uid) => sum + cumulative[uid], 0);

    days.push({ date: dateStr, dayNumber, values: { ...dayValues }, cumulative: { ...cumulative }, groupTotal, leader });
  }

  // Compute moments based on target type
  const moments: IncentiveRecapMoment[] = [];
  let prevLeader: string | null = null;
  let bestDayInfo: { userId: string; value: number; dayNumber: number } | null = null;
  let leadChanges = 0;
  const targetType = incentive.target_type;
  const targetValue = incentive.target_value || 0;
  const qualifiedUsers = new Set<string>();

  // Track milestones hit for group_total
  const milestonesHit = new Set<number>();

  days.forEach((day, i) => {
    const anyScored = userIds.some(uid => day.values[uid] > 0);

    // First score
    if (moments.length === 0 && anyScored) {
      const scorers = userIds.filter(uid => day.values[uid] > 0);
      if (scorers.length >= 1) {
        const topScorer = scorers.reduce((a, b) => day.values[a] > day.values[b] ? a : b);
        moments.push({
          dayNumber: day.dayNumber, date: day.date, type: 'first_score',
          narrative: `${participantNames[topScorer]} gets on the board first`,
          userId: topScorer, value: day.values[topScorer],
        });
      }
    }

    // Type-specific moments
    if (targetType === 'first_to' || targetType === 'most_by_end') {
      if (day.leader && day.leader !== prevLeader && prevLeader !== null && i > 0) {
        leadChanges++;
        moments.push({
          dayNumber: day.dayNumber, date: day.date, type: 'lead_change',
          narrative: `${participantNames[day.leader]} takes the lead!`,
          userId: day.leader,
        });
      }
      prevLeader = day.leader;
    }

    if (targetType === 'group_total' && targetValue > 0) {
      const gt = day.groupTotal || 0;
      [25, 50, 75, 100].forEach(pct => {
        if (!milestonesHit.has(pct) && gt >= targetValue * (pct / 100)) {
          milestonesHit.add(pct);
          moments.push({
            dayNumber: day.dayNumber, date: day.date, type: 'milestone',
            narrative: pct === 100 ? '🎉 Group goal reached!' : `${pct}% of goal reached`,
            value: gt,
          });
        }
      });
    }

    if (targetType === 'anyone_who' && targetValue > 0) {
      userIds.forEach(uid => {
        if (!qualifiedUsers.has(uid) && day.cumulative[uid] >= targetValue) {
          qualifiedUsers.add(uid);
          moments.push({
            dayNumber: day.dayNumber, date: day.date, type: 'qualified',
            narrative: `${participantNames[uid]} qualified! 🏆`,
            userId: uid, value: day.cumulative[uid],
          });
        }
      });
    }

    // Track best day
    userIds.forEach(uid => {
      if (!bestDayInfo || day.values[uid] > bestDayInfo.value) {
        bestDayInfo = { userId: uid, value: day.values[uid], dayNumber: day.dayNumber };
      }
    });
  });

  // Final moment
  const lastDay = days[days.length - 1];
  if (lastDay) {
    const winnerId = incentive.winner_user_id;
    const winnerIds = Array.isArray(incentive.winner_user_ids) ? incentive.winner_user_ids : [];
    let finalNarrative = 'Incentive complete!';
    if (targetType === 'anyone_who') {
      finalNarrative = `${winnerIds.length} rep${winnerIds.length !== 1 ? 's' : ''} qualified!`;
    } else if (targetType === 'group_total') {
      const gt = lastDay.groupTotal || 0;
      finalNarrative = gt >= targetValue ? 'Group goal achieved! 🎉' : `Fell short — ${gt.toFixed(1)} of ${targetValue}`;
    } else if (winnerId) {
      finalNarrative = `${participantNames[winnerId]} wins! 🏆`;
    }
    moments.push({ dayNumber: lastDay.dayNumber, date: lastDay.date, type: 'final', narrative: finalNarrative });
  }

  // Biggest day (if notable and not already a moment)
  if (bestDayInfo && (bestDayInfo as any).value > 0) {
    const bd = bestDayInfo as { userId: string; value: number; dayNumber: number };
    const alreadyHasMoment = moments.some(m => m.dayNumber === bd.dayNumber && m.type !== 'final');
    if (!alreadyHasMoment && dayNumber > 1) {
      moments.push({
        dayNumber: bd.dayNumber, date: days[bd.dayNumber - 1]?.date || '', type: 'biggest_day',
        narrative: `${participantNames[bd.userId]} has their best day`,
        userId: bd.userId, value: bd.value,
      });
    }
  }

  moments.sort((a, b) => a.dayNumber - b.dayNumber);

  // Stats
  const finalValues = eligibleReps.map(r => r.final_value ?? 0).sort((a, b) => b - a);
  const margin = finalValues.length >= 2 ? finalValues[0] - finalValues[1] : 0;
  const groupTotal = lastDay ? (lastDay.groupTotal || 0) : 0;

  const stats: IncentiveRecapStats = {
    duration: dayNumber,
    margin,
    leadChanges,
    bestDay: bestDayInfo && (bestDayInfo as any).value > 0 ? {
      userId: (bestDayInfo as any).userId,
      name: participantNames[(bestDayInfo as any).userId],
      value: (bestDayInfo as any).value,
      dayNumber: (bestDayInfo as any).dayNumber,
    } : null,
    qualifiedCount: qualifiedUsers.size,
    groupTotal,
    targetValue: targetValue,
  };

  return { days, moments, stats, participantNames, intraDayData };
}

export const useIncentiveRecap = (incentive: Incentive | null) => {
  return useQuery({
    queryKey: ['incentive-recap', incentive?.id],
    queryFn: () => fetchIncentiveRecap(incentive!),
    enabled: !!incentive && incentive.status === 'completed',
    staleTime: 1000 * 60 * 10,
  });
};
