import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Challenge, ChallengeMetric } from './useChallenges';
import { getCleanFirstName } from '@/utils/nameUtils';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

/**
 * A distilled "moment" in a single-day competition.
 * We show the highest-signal event, not every raw counter tick.
 */
export interface RecapMoment {
  time: Date;
  timeStr: string;
  userId: string;
  userName: string;
  type: 'sale' | 'close' | 'transition' | 'door_batch' | 'started';
  label: string;
  emoji: string;
  value?: number;
  runningScore: Record<string, number>;
}

export interface SingleDayRecapData {
  moments: RecapMoment[];
  participantNames: Record<string, string>;
  summary: {
    totalEvents: number;
    firstActivity: { userId: string; timeStr: string } | null;
  };
}

function fmtTime(isoStr: string, tz: string): string {
  try {
    return formatInTimeZone(new Date(isoStr), tz, 'h:mm a');
  } catch {
    try { return format(parseISO(isoStr), 'h:mm a'); } catch { return ''; }
  }
}

/**
 * Builds a lean set of "moments" from raw timestamps using a waterfall:
 * 
 * For FP+/PRMR metrics:
 *   Sales (from sales_log) are the primary events — each one is a moment.
 *   Closes without a matching sale → shown as a moment.
 *   Transitions without a close nearby → shown as a moment.
 *   Doors are batched into ~30-min windows and shown as "Knocked X doors".
 * 
 * For Transitions metric:
 *   Each transition is a moment. Doors batched as context.
 * 
 * For Doors metric:
 *   Doors batched into windows. Each batch is a moment.
 */
async function fetchSingleDayRecap(challenge: Challenge): Promise<SingleDayRecapData | null> {
  const participants = challenge.participants || [];
  if (participants.length < 2) return null;

  const userIds = participants.map(p => p.user_id);
  const dateStr = challenge.start_date;

  const { data: entries } = await supabase
    .from('daily_entries')
    .select('user_id, counter_timestamps, sales_log, timezone, fp_plus, prmr, transitions, doors_knocked, work_start_time')
    .in('user_id', userIds)
    .eq('entry_date', dateStr);

  if (!entries) return null;

  const participantNames: Record<string, string> = {};
  participants.forEach(p => {
    participantNames[p.user_id] = getCleanFirstName(p.rep_name) || 'Unknown';
  });

  const moments: RecapMoment[] = [];
  const runningScore: Record<string, number> = {};
  userIds.forEach(uid => { runningScore[uid] = 0; });

  const metric = challenge.metric;

  for (const entry of entries) {
    const uid = entry.user_id;
    const name = participantNames[uid];
    const tz = entry.timezone || 'America/New_York';
    const timestamps = entry.counter_timestamps as Record<string, string[]> | null;
    const salesLog = (entry.sales_log as any[] | null) || [];

    // Parse all raw timestamps into typed arrays
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

    // Track which close timestamps are "covered" by a sale (within 5 min)
    const coveredCloses = new Set<number>();
    sales.forEach(sale => {
      closes.forEach((c, ci) => {
        if (Math.abs(sale.time.getTime() - c.time.getTime()) < 5 * 60 * 1000) {
          coveredCloses.add(ci);
        }
      });
    });

    // Track which transition timestamps are "covered" by a close (within 60 min)
    const coveredTransitions = new Set<number>();
    closes.forEach(c => {
      transitions.forEach((t, ti) => {
        if (c.time.getTime() - t.time.getTime() > 0 && c.time.getTime() - t.time.getTime() < 60 * 60 * 1000) {
          coveredTransitions.add(ti);
        }
      });
    });

    // --- Build moments based on metric ---

    if (metric === 'fp_plus' || metric === 'prmr') {
      // 1. Sales are the hero events
      sales.forEach(sale => {
        const isFP = sale.type === 'fp';
        const scoreInc = metric === 'prmr' ? sale.prmr : 1;
        runningScore[uid] += scoreInc;
        moments.push({
          time: sale.time,
          timeStr: fmtTime(sale.ts, tz),
          userId: uid,
          userName: name,
          type: 'sale',
          label: isFP ? `Sold — $${sale.prmr.toLocaleString()}` : `Upgrade — $${sale.prmr.toLocaleString()}`,
          emoji: '💰',
          value: sale.prmr,
          runningScore: { ...runningScore },
        });
      });

      // 2. Orphan closes (no matching sale)
      closes.forEach((c, ci) => {
        if (coveredCloses.has(ci)) return;
        moments.push({
          time: c.time,
          timeStr: fmtTime(c.ts, tz),
          userId: uid,
          userName: name,
          type: 'close',
          label: 'Close (no sale logged)',
          emoji: '✅',
          runningScore: { ...runningScore },
        });
      });

      // 3. Orphan transitions (no close nearby) — only show if few
      const orphanTransitions = transitions.filter((_, ti) => !coveredTransitions.has(ti));
      orphanTransitions.forEach(t => {
        moments.push({
          time: t.time,
          timeStr: fmtTime(t.ts, tz),
          userId: uid,
          userName: name,
          type: 'transition',
          label: 'Transition',
          emoji: '🔄',
          runningScore: { ...runningScore },
        });
      });

      // 4. Batch doors into ~1hr windows as context
      if (doors.length > 0) {
        batchDoors(doors, uid, name, tz, moments, runningScore);
      }

    } else if (metric === 'transitions') {
      // Each transition is a primary moment
      transitions.forEach(t => {
        runningScore[uid] += 1;
        moments.push({
          time: t.time,
          timeStr: fmtTime(t.ts, tz),
          userId: uid,
          userName: name,
          type: 'transition',
          label: 'Transition',
          emoji: '🔄',
          runningScore: { ...runningScore },
        });
      });

      // Batch doors as context
      if (doors.length > 0) {
        batchDoors(doors, uid, name, tz, moments, runningScore);
      }

    } else if (metric === 'doors_knocked') {
      // Batch doors — each batch moves the score
      if (doors.length > 0) {
        batchDoorsWithScore(doors, uid, name, tz, moments, runningScore);
      }
    }

    // Add "started knocking" moment if we have a work_start_time
    if (entry.work_start_time) {
      const startTime = new Date(entry.work_start_time);
      moments.push({
        time: startTime,
        timeStr: fmtTime(entry.work_start_time, tz),
        userId: uid,
        userName: name,
        type: 'started',
        label: 'Started knocking',
        emoji: '🏁',
        runningScore: { ...runningScore },
      });
    }
  }

  // Sort chronologically
  moments.sort((a, b) => a.time.getTime() - b.time.getTime());

  // Re-compute running scores in chronological order for accuracy
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

  // Find first activity
  const firstMoment = moments.find(m => m.type !== 'started');
  const firstActivity = firstMoment
    ? { userId: firstMoment.userId, timeStr: firstMoment.timeStr }
    : null;

  return {
    moments,
    participantNames,
    summary: {
      totalEvents: moments.length,
      firstActivity,
    },
  };
}

/** Batch doors into ~1hr windows (context-only, no score impact) */
function batchDoors(
  doors: { time: Date; ts: string }[],
  uid: string,
  name: string,
  tz: string,
  moments: RecapMoment[],
  runningScore: Record<string, number>,
) {
  const WINDOW_MS = 60 * 60 * 1000; // 1 hour
  const sorted = [...doors].sort((a, b) => a.time.getTime() - b.time.getTime());
  let batchStart = sorted[0].time.getTime();
  let batchCount = 0;
  let batchFirstTs = sorted[0].ts;

  for (let i = 0; i < sorted.length; i++) {
    const d = sorted[i];
    if (d.time.getTime() - batchStart > WINDOW_MS) {
      // Emit batch
      moments.push({
        time: new Date(batchStart),
        timeStr: fmtTime(batchFirstTs, tz),
        userId: uid,
        userName: name,
        type: 'door_batch',
        label: `Knocked ${batchCount} door${batchCount !== 1 ? 's' : ''}`,
        emoji: '🚪',
        value: batchCount,
        runningScore: { ...runningScore },
      });
      batchStart = d.time.getTime();
      batchCount = 1;
      batchFirstTs = d.ts;
    } else {
      batchCount++;
    }
  }
  // Emit final batch
  if (batchCount > 0) {
    moments.push({
      time: new Date(batchStart),
      timeStr: fmtTime(batchFirstTs, tz),
      userId: uid,
      userName: name,
      type: 'door_batch',
      label: `Knocked ${batchCount} door${batchCount !== 1 ? 's' : ''}`,
      emoji: '🚪',
      value: batchCount,
      runningScore: { ...runningScore },
    });
  }
}

/** Batch doors into ~1hr windows (score-impacting for doors_knocked metric) */
function batchDoorsWithScore(
  doors: { time: Date; ts: string }[],
  uid: string,
  name: string,
  tz: string,
  moments: RecapMoment[],
  runningScore: Record<string, number>,
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
        time: new Date(batchStart),
        timeStr: fmtTime(batchFirstTs, tz),
        userId: uid,
        userName: name,
        type: 'door_batch',
        label: `Knocked ${batchCount} door${batchCount !== 1 ? 's' : ''}`,
        emoji: '🚪',
        value: batchCount,
        runningScore: { ...runningScore },
      });
      batchStart = d.time.getTime();
      batchCount = 1;
      batchFirstTs = d.ts;
    } else {
      batchCount++;
    }
  }
  if (batchCount > 0) {
    runningScore[uid] += batchCount;
    moments.push({
      time: new Date(batchStart),
      timeStr: fmtTime(batchFirstTs, tz),
      userId: uid,
      userName: name,
      type: 'door_batch',
      label: `Knocked ${batchCount} door${batchCount !== 1 ? 's' : ''}`,
      emoji: '🚪',
      value: batchCount,
      runningScore: { ...runningScore },
    });
  }
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
