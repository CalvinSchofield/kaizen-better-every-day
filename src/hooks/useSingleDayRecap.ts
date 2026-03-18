import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Challenge, ChallengeMetric } from './useChallenges';
import { getCleanFirstName } from '@/utils/nameUtils';
import { parseISO, format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

export interface IntraDayEvent {
  time: Date;
  timeStr: string; // formatted like "2:34 PM"
  userId: string;
  userName: string;
  type: 'door' | 'transition' | 'pitch' | 'dm' | 'presentation' | 'close' | 'sale' | 'fp';
  label: string;
  emoji: string;
  value?: number; // e.g. PRMR for a sale
  runningTotal?: Record<string, number>; // cumulative per user after this event
}

export interface SingleDayRecapData {
  events: IntraDayEvent[];
  participantNames: Record<string, string>;
  finalTotals: Record<string, number>;
}

// Map challenge metric to relevant counter_timestamps keys
const metricToTimestampKeys: Record<ChallengeMetric, string[]> = {
  doors_knocked: ['doors_knocked'],
  transitions: ['transitions', 'doors_knocked'],
  fp_plus: ['closes', 'transitions', 'doors_knocked'],
  prmr: ['closes', 'transitions', 'doors_knocked'],
};

const eventMeta: Record<string, { label: string; emoji: string; type: IntraDayEvent['type'] }> = {
  doors_knocked: { label: 'Knocked', emoji: '🚪', type: 'door' },
  transitions: { label: 'Transition', emoji: '🔄', type: 'transition' },
  pitches: { label: 'Pitch', emoji: '🎤', type: 'pitch' },
  decision_makers: { label: 'Decision Maker', emoji: '🤝', type: 'dm' },
  presentations: { label: 'Presentation', emoji: '📊', type: 'presentation' },
  closes: { label: 'Close', emoji: '✅', type: 'close' },
  fp_plus: { label: 'FP+', emoji: '🎯', type: 'fp' },
};

function formatTimeLocal(isoStr: string, timezone: string): string {
  try {
    return formatInTimeZone(new Date(isoStr), timezone, 'h:mm a');
  } catch {
    try {
      return format(parseISO(isoStr), 'h:mm a');
    } catch {
      return '';
    }
  }
}

async function fetchSingleDayRecap(challenge: Challenge): Promise<SingleDayRecapData | null> {
  const participants = challenge.participants || [];
  if (participants.length < 2) return null;

  const userIds = participants.map(p => p.user_id);
  const dateStr = challenge.start_date; // single day

  const { data: entries } = await supabase
    .from('daily_entries')
    .select('user_id, counter_timestamps, sales_log, timezone, fp_plus, prmr, transitions, doors_knocked')
    .in('user_id', userIds)
    .eq('entry_date', dateStr);

  if (!entries) return null;

  const participantNames: Record<string, string> = {};
  participants.forEach(p => {
    participantNames[p.user_id] = getCleanFirstName(p.rep_name) || 'Unknown';
  });

  const events: IntraDayEvent[] = [];

  // Determine which timestamp keys are relevant for this metric
  const relevantKeys = metricToTimestampKeys[challenge.metric] || ['doors_knocked'];

  for (const entry of entries) {
    const uid = entry.user_id;
    const name = participantNames[uid];
    const tz = (entry as any).timezone || 'America/New_York';
    const timestamps = entry.counter_timestamps as Record<string, string[]> | null;

    // Add counter timestamp events
    if (timestamps) {
      for (const key of relevantKeys) {
        const tsList = timestamps[key];
        if (!tsList || !Array.isArray(tsList)) continue;
        const meta = eventMeta[key] || { label: key, emoji: '•', type: 'door' as const };

        for (const ts of tsList) {
          events.push({
            time: new Date(ts),
            timeStr: formatTimeLocal(ts, tz),
            userId: uid,
            userName: name,
            type: meta.type,
            label: meta.label,
            emoji: meta.emoji,
          });
        }
      }
    }

    // Add sales from sales_log (for fp_plus / prmr metrics)
    if (challenge.metric === 'fp_plus' || challenge.metric === 'prmr') {
      const salesLog = entry.sales_log as any[] | null;
      if (salesLog && Array.isArray(salesLog)) {
        for (const sale of salesLog) {
          if (sale.install_status === 'never_installed') continue;
          if (!sale.timestamp) continue;

          const isFP = sale.type === 'fp';
          const prmr = Number(sale.prmr) || 0;

          events.push({
            time: new Date(sale.timestamp),
            timeStr: formatTimeLocal(sale.timestamp, tz),
            userId: uid,
            userName: name,
            type: 'sale',
            label: isFP ? `Sale — $${prmr.toLocaleString()}` : `Upgrade — $${prmr.toLocaleString()}`,
            emoji: '💰',
            value: prmr,
          });
        }
      }
    }
  }

  // Sort chronologically
  events.sort((a, b) => a.time.getTime() - b.time.getTime());

  // Compute running totals for the challenge metric
  const metricCol = challenge.metric;
  const runningTotals: Record<string, number> = {};
  userIds.forEach(uid => { runningTotals[uid] = 0; });

  // For doors/transitions, each counter_timestamps entry is +1
  // For fp_plus/prmr, sales carry the value
  for (const event of events) {
    if (metricCol === 'doors_knocked' && event.type === 'door') {
      runningTotals[event.userId] += 1;
    } else if (metricCol === 'transitions' && event.type === 'transition') {
      runningTotals[event.userId] += 1;
    } else if ((metricCol === 'fp_plus') && event.type === 'sale') {
      // Each sale is roughly 1 FP (could be more nuanced but good enough)
      const sale = event;
      runningTotals[sale.userId] += 1;
    } else if (metricCol === 'prmr' && event.type === 'sale') {
      runningTotals[event.userId] += event.value || 0;
    }
    event.runningTotal = { ...runningTotals };
  }

  const finalTotals: Record<string, number> = {};
  userIds.forEach(uid => {
    const entry = entries.find(e => e.user_id === uid);
    if (entry) {
      const col = metricCol as keyof typeof entry;
      finalTotals[uid] = Number(entry[col]) || 0;
    } else {
      finalTotals[uid] = 0;
    }
  });

  return { events, participantNames, finalTotals };
}

export const useSingleDayRecap = (challenge: Challenge | null) => {
  const isSingleDay = challenge ? challenge.start_date === challenge.end_date : false;

  return useQuery({
    queryKey: ['single-day-recap', challenge?.id],
    queryFn: () => fetchSingleDayRecap(challenge!),
    enabled: !!challenge && challenge.status === 'completed' && challenge.type === '1v1' && isSingleDay,
    staleTime: 1000 * 60 * 10,
  });
};
