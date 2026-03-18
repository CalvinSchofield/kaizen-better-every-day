import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Challenge, ChallengeMetric } from './useChallenges';
import { getCleanFirstName } from '@/utils/nameUtils';

export interface RecapDay {
  date: string;
  dayNumber: number;
  values: Record<string, number>; // userId -> daily value
  cumulative: Record<string, number>; // userId -> running total
  leader: string | null; // userId of leader after this day
}

export interface RecapMoment {
  dayNumber: number;
  date: string;
  type: 'first_score' | 'lead_change' | 'biggest_day' | 'final';
  narrative: string;
  userId?: string;
  value?: number;
}

export interface RecapStats {
  duration: number;
  margin: number;
  leadChanges: number;
  bestDay: { userId: string; name: string; value: number; dayNumber: number } | null;
}

export interface ChallengeRecapData {
  days: RecapDay[];
  moments: RecapMoment[];
  stats: RecapStats;
  participantNames: Record<string, string>;
}

const metricColumn: Record<ChallengeMetric, string> = {
  fp_plus: 'fp_plus',
  prmr: 'prmr',
  transitions: 'transitions',
  doors_knocked: 'doors_knocked',
};

async function fetchRecapData(challenge: Challenge): Promise<ChallengeRecapData | null> {
  const participants = challenge.participants || [];
  if (participants.length < 2) return null;

  const userIds = participants.map(p => p.user_id);
  const col = metricColumn[challenge.metric];

  const { data: entries } = await supabase
    .from('daily_entries')
    .select(`user_id, entry_date, ${col}`)
    .in('user_id', userIds)
    .gte('entry_date', challenge.start_date)
    .lte('entry_date', challenge.end_date)
    .order('entry_date', { ascending: true });

  if (!entries) return null;

  // Build participant name map
  const participantNames: Record<string, string> = {};
  participants.forEach(p => {
    participantNames[p.user_id] = getCleanFirstName(p.rep_name) || 'Unknown';
  });

  // Build day-by-day data
  const startDate = new Date(challenge.start_date + 'T00:00:00');
  const endDate = new Date(challenge.end_date + 'T00:00:00');
  const days: RecapDay[] = [];
  const cumulative: Record<string, number> = {};
  userIds.forEach(id => { cumulative[id] = 0; });

  let dayNumber = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    dayNumber++;
    const dateStr = d.toISOString().split('T')[0];
    const dayValues: Record<string, number> = {};

    userIds.forEach(uid => {
      const entry = entries.find(e => e.user_id === uid && e.entry_date === dateStr);
      const val = entry ? Number((entry as any)[col]) || 0 : 0;
      dayValues[uid] = val;
      cumulative[uid] += val;
    });

    // Determine leader
    let leader: string | null = null;
    let maxVal = 0;
    let tied = false;
    userIds.forEach(uid => {
      if (cumulative[uid] > maxVal) {
        maxVal = cumulative[uid];
        leader = uid;
        tied = false;
      } else if (cumulative[uid] === maxVal && cumulative[uid] > 0) {
        tied = true;
      }
    });
    if (tied) leader = null;

    days.push({
      date: dateStr,
      dayNumber,
      values: { ...dayValues },
      cumulative: { ...cumulative },
      leader,
    });
  }

  // Compute moments
  const moments: RecapMoment[] = [];
  let prevLeader: string | null = null;
  let bestDayInfo: { userId: string; value: number; dayNumber: number } | null = null;
  let leadChanges = 0;

  days.forEach((day, i) => {
    const anyScored = userIds.some(uid => day.values[uid] > 0);

    // First score
    if (i === 0 && anyScored) {
      const scorers = userIds.filter(uid => day.values[uid] > 0);
      if (scorers.length === 1) {
        moments.push({
          dayNumber: day.dayNumber, date: day.date, type: 'first_score',
          narrative: `${participantNames[scorers[0]]} gets on the board first`,
          userId: scorers[0], value: day.values[scorers[0]],
        });
      }
    }

    // Lead change
    if (day.leader && day.leader !== prevLeader && prevLeader !== null && i > 0) {
      leadChanges++;
      moments.push({
        dayNumber: day.dayNumber, date: day.date, type: 'lead_change',
        narrative: `${participantNames[day.leader]} takes the lead!`,
        userId: day.leader,
      });
    }
    prevLeader = day.leader;

    // Track best day
    userIds.forEach(uid => {
      if (!bestDayInfo || day.values[uid] > bestDayInfo.value) {
        bestDayInfo = { userId: uid, value: day.values[uid], dayNumber: day.dayNumber };
      }
    });
  });

  // Final day moment
  const lastDay = days[days.length - 1];
  if (lastDay) {
    const winnerId = challenge.winner_user_id;
    moments.push({
      dayNumber: lastDay.dayNumber, date: lastDay.date, type: 'final',
      narrative: winnerId
        ? `${participantNames[winnerId]} clinches the win!`
        : 'Challenge complete!',
    });
  }

  // Biggest day moment (if notable)
  if (bestDayInfo && (bestDayInfo as any).value > 0) {
    const bd = bestDayInfo as { userId: string; value: number; dayNumber: number };
    // Only add if not already a moment on that day
    const alreadyHasMoment = moments.some(m => m.dayNumber === bd.dayNumber && m.type !== 'final');
    if (!alreadyHasMoment) {
      moments.push({
        dayNumber: bd.dayNumber, date: days[bd.dayNumber - 1]?.date || '', type: 'biggest_day',
        narrative: `${participantNames[bd.userId]} has their best day`,
        userId: bd.userId, value: bd.value,
      });
    }
  }

  // Sort moments by day
  moments.sort((a, b) => a.dayNumber - b.dayNumber);

  const p1Final = participants[0].final_value ?? 0;
  const p2Final = participants[1].final_value ?? 0;
  const margin = Math.abs(p1Final - p2Final);

  const stats: RecapStats = {
    duration: dayNumber,
    margin,
    leadChanges,
    bestDay: bestDayInfo && (bestDayInfo as any).value > 0 ? {
      userId: (bestDayInfo as any).userId,
      name: participantNames[(bestDayInfo as any).userId],
      value: (bestDayInfo as any).value,
      dayNumber: (bestDayInfo as any).dayNumber,
    } : null,
  };

  return { days, moments, stats, participantNames };
}

export const useChallengeRecap = (challenge: Challenge | null) => {
  return useQuery({
    queryKey: ['challenge-recap', challenge?.id],
    queryFn: () => fetchRecapData(challenge!),
    enabled: !!challenge && challenge.status === 'completed' && challenge.type === '1v1',
    staleTime: 1000 * 60 * 10,
  });
};
