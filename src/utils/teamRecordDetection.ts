import { startOfWeek, format, getDay } from 'date-fns';

export interface GroupRecord {
  value: number;
  date: string;
  repsWorked: number;
}

export interface MetricRecords {
  fp: GroupRecord | null;
  prmr: GroupRecord | null;
  doors: GroupRecord | null;
  dms: GroupRecord | null;
  pitches: GroupRecord | null;
  presentations: GroupRecord | null;
  closes: GroupRecord | null;
  avgStartMinutes: GroupRecord | null; // lowest = earliest
  activeHours: GroupRecord | null;
}

/** Tracks the second-best record per metric (the "previous record" before the current one) */
export type SecondBestRecords = Partial<Record<keyof MetricRecords, GroupRecord>>;

export interface AllTimeGroupRecords {
  daily: MetricRecords;
  weekly: MetricRecords;
  monthly: MetricRecords;
  dayOfWeek: Record<number, MetricRecords>; // 0=Sun .. 6=Sat
  periodCounts: {
    daily: number;
    weekly: number;
    monthly: number;
    dayOfWeek: Record<number, number>;
  };
  /** Second-best records per granularity for "vs prev record" display */
  secondBest: {
    daily: SecondBestRecords;
    weekly: SecondBestRecords;
    monthly: SecondBestRecords;
  };
}

export interface ActiveRecord {
  metricKey: string;
  label: string;
  currentValue: number;
  recordValue: number;
  /** The previous record value (second-best all-time) — what was beaten */
  previousRecordValue?: number;
  previousRecordDate?: string;
  recordDate: string;
  recordReps: number;
  isRecord: boolean;
  onPace: boolean;
  dayOfWeekLabel?: string;
  granularity: 'daily' | 'weekly' | 'monthly';
  /** Contextual description e.g. "Best Tuesday this Quarter" */
  contextualLabel?: string;
}
}

interface EntryLike {
  entry_date: string;
  user_id: string;
  doors_knocked: number | null;
  decision_makers: number | null;
  pitches: number | null;
  presentations: number | null;
  closes: number | null;
  fp_plus: number | null;
  prmr: number | null;
  work_start_time: string | null;
  work_end_time: string | null;
  timezone: string | null;
  break_periods: any;
}

function getLocalMinutes(utcTimestamp: string, timezone: string | null): number | null {
  try {
    const tz = timezone || 'America/Denver';
    const d = new Date(utcTimestamp);
    if (isNaN(d.getTime())) return null;
    const localTime = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).format(d);
    const [h, m] = localTime.split(':').map(Number);
    return h * 60 + m;
  } catch {
    return null;
  }
}

function emptyMetricRecords(): MetricRecords {
  return {
    fp: null, prmr: null, doors: null, dms: null,
    pitches: null, presentations: null, closes: null,
    avgStartMinutes: null, activeHours: null,
  };
}

function computeGroupedRecords(
  entries: EntryLike[],
  groupKeyFn: (date: string) => string
): { records: MetricRecords; secondBest: SecondBestRecords; periodCount: number } {
  const groups = new Map<string, EntryLike[]>();
  entries.forEach(e => {
    const key = groupKeyFn(e.entry_date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  });

  const records = emptyMetricRecords();
  const secondBest: SecondBestRecords = {};

  // Collect all period totals so we can find top-2
  const periodTotals: Array<{
    key: string;
    repsWorked: number;
    fp: number; prmr: number; doors: number; dms: number;
    pitches: number; presentations: number; closes: number;
    activeHours: number; avgStartMinutes: number | null;
  }> = [];

  groups.forEach((groupEntries, key) => {
    const repsWorked = new Set(groupEntries.map(e => e.user_id)).size;

    let totalFp = 0, totalPrmr = 0, totalDoors = 0, totalDms = 0;
    let totalPitches = 0, totalPres = 0, totalCloses = 0;
    let totalMinutes = 0;
    const startMinutesList: number[] = [];

    groupEntries.forEach(e => {
      totalFp += Number(e.fp_plus) || 0;
      totalPrmr += Number(e.prmr) || 0;
      totalDoors += e.doors_knocked || 0;
      totalDms += e.decision_makers || 0;
      totalPitches += e.pitches || 0;
      totalPres += e.presentations || 0;
      totalCloses += e.closes || 0;

      if (e.work_start_time && e.work_end_time) {
        const start = new Date(e.work_start_time);
        const end = new Date(e.work_end_time);
        let mins = (end.getTime() - start.getTime()) / 60000;
        if (mins > 0) {
          if (e.break_periods && Array.isArray(e.break_periods)) {
            e.break_periods.forEach((bp: any) => {
              const bStart = new Date(bp.start);
              const bEnd = new Date(bp.end);
              const bMins = (bEnd.getTime() - bStart.getTime()) / 60000;
              if (bMins > 0) mins -= bMins;
            });
          }
          totalMinutes += Math.max(0, mins);
        }
      }

      if (e.work_start_time) {
        const m = getLocalMinutes(e.work_start_time, e.timezone);
        if (m !== null) startMinutesList.push(m);
      }
    });

    const avgStart = startMinutesList.length > 0
      ? startMinutesList.reduce((a, b) => a + b, 0) / startMinutesList.length
      : null;
    const activeHours = totalMinutes / 60;

    periodTotals.push({
      key, repsWorked, fp: totalFp, prmr: totalPrmr, doors: totalDoors,
      dms: totalDms, pitches: totalPitches, presentations: totalPres,
      closes: totalCloses, activeHours, avgStartMinutes: avgStart,
    });
  });

  // Find top-1 and top-2 for each metric
  const metricFields = ['fp', 'prmr', 'doors', 'dms', 'pitches', 'presentations', 'closes', 'activeHours'] as const;
  
  for (const field of metricFields) {
    const sorted = [...periodTotals]
      .filter(p => (p as any)[field] > 0)
      .sort((a, b) => ((b as any)[field] as number) - ((a as any)[field] as number));
    
    if (sorted.length >= 1) {
      (records as any)[field] = { value: (sorted[0] as any)[field], date: sorted[0].key, repsWorked: sorted[0].repsWorked };
    }
    if (sorted.length >= 2) {
      (secondBest as any)[field] = { value: (sorted[1] as any)[field], date: sorted[1].key, repsWorked: sorted[1].repsWorked };
    }
  }

  // avgStartMinutes — lower is better
  const startSorted = [...periodTotals]
    .filter(p => p.avgStartMinutes !== null)
    .sort((a, b) => a.avgStartMinutes! - b.avgStartMinutes!);
  
  if (startSorted.length >= 1) {
    records.avgStartMinutes = { value: startSorted[0].avgStartMinutes!, date: startSorted[0].key, repsWorked: startSorted[0].repsWorked };
  }
  if (startSorted.length >= 2) {
    secondBest.avgStartMinutes = { value: startSorted[1].avgStartMinutes!, date: startSorted[1].key, repsWorked: startSorted[1].repsWorked };
  }

  return { records, secondBest, periodCount: groups.size };
}

export function computeAllTimeGroupRecords(entries: EntryLike[]): AllTimeGroupRecords {
  const active = entries.filter(e =>
    (e.doors_knocked || 0) > 0 || (e.decision_makers || 0) > 0 ||
    (e.pitches || 0) > 0 || (e.presentations || 0) > 0 ||
    (e.closes || 0) > 0
  );

  const daily = computeGroupedRecords(active, d => d);

  const weekly = computeGroupedRecords(active, d => {
    const weekStart = startOfWeek(new Date(d + 'T12:00:00'), { weekStartsOn: 0 });
    return format(weekStart, 'yyyy-MM-dd');
  });

  const monthly = computeGroupedRecords(active, d => d.substring(0, 7));

  const dayOfWeek: Record<number, MetricRecords> = {};
  const dayOfWeekCounts: Record<number, number> = {};

  for (let dow = 0; dow <= 6; dow++) {
    const dowEntries = active.filter(e => getDay(new Date(e.entry_date + 'T12:00:00')) === dow);
    const result = computeGroupedRecords(dowEntries, d => d);
    dayOfWeek[dow] = result.records;
    dayOfWeekCounts[dow] = result.periodCount;
  }

  return {
    daily: daily.records,
    weekly: weekly.records,
    monthly: monthly.records,
    dayOfWeek,
    periodCounts: {
      daily: daily.periodCount,
      weekly: weekly.periodCount,
      monthly: monthly.periodCount,
      dayOfWeek: dayOfWeekCounts,
    },
    secondBest: {
      daily: daily.secondBest,
      weekly: weekly.secondBest,
      monthly: monthly.secondBest,
    },
  };
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const GRANULARITY_LABELS: Record<string, string> = {
  daily: 'day', weekly: 'week', monthly: 'month',
};

const METRIC_LABELS: Record<string, string> = {
  fp: 'FP+', prmr: 'PRMR', doors: 'Doors', dms: 'DMs',
  pitches: 'Pitches', presentations: 'Presentations', closes: 'Closes',
  avgStartMinutes: 'Avg Start', activeHours: 'Active Hours',
};

/**
 * Generate a contextual label for a record e.g. "Best Tuesday this Quarter"
 */
function generateContextualLabel(
  metricLabel: string,
  granularity: 'daily' | 'weekly' | 'monthly',
  isRecord: boolean,
  onPace: boolean,
  currentDate?: Date,
  dayOfWeekLabel?: string,
): string {
  if (dayOfWeekLabel) return dayOfWeekLabel;

  const now = currentDate || new Date();
  const month = now.getMonth();
  // Q1=Jan-Mar, Q2=Apr-Jun, etc.
  const quarterLabel = month < 3 ? 'Q1' : month < 6 ? 'Q2' : month < 9 ? 'Q3' : 'Q4';

  const granLabel = GRANULARITY_LABELS[granularity] || granularity;

  if (isRecord) {
    if (granularity === 'daily') {
      return `Best ${DAY_NAMES[now.getDay()]} ${metricLabel} (${quarterLabel})`;
    }
    if (granularity === 'weekly') {
      return `Best ${granLabel} ${metricLabel} this season`;
    }
    return `Best ${granLabel} ${metricLabel} this season`;
  }

  // On pace
  return `On pace for best ${granLabel} ${metricLabel}`;
}

/**
 * Compare current totals against all-time records for the given preset.
 * Returns active records (broken or on-pace).
 */
export function detectActiveRecords(
  allTimeRecords: AllTimeGroupRecords | undefined,
  currentTotals: {
    fp: number; prmr: number; doors: number; dms: number;
    pitches: number; presentations: number; closes: number;
    avgStartMinutes?: number; activeHours?: number;
  },
  preset: string,
  isLiveView: boolean,
  currentDate?: Date,
): ActiveRecord[] {
  if (!allTimeRecords) return [];

  // Map preset → granularity
  let granularity: 'daily' | 'weekly' | 'monthly' | null = null;
  switch (preset) {
    case 'today':
    case 'yesterday':
      granularity = 'daily';
      break;
    case 'week':
    case 'lastWeek':
      granularity = 'weekly';
      break;
    case 'month':
    case 'lastMonth':
      granularity = 'monthly';
      break;
    default:
      return []; // preseason, ytd, custom — no comparison pool
  }

  const records = allTimeRecords[granularity];
  const minPeriods = 3; // Suppress if < 3 comparable periods
  const periodCount = allTimeRecords.periodCounts[granularity];
  if (periodCount < minPeriods) return [];

  const result: ActiveRecord[] = [];
  const metricKeys = ['fp', 'prmr', 'doors', 'dms', 'pitches', 'presentations', 'closes', 'activeHours'] as const;

  for (const key of metricKeys) {
    const record = records[key];
    if (!record) continue;

    const currentValue = key === 'activeHours'
      ? (currentTotals.activeHours || 0)
      : (currentTotals as any)[key] || 0;

    if (currentValue <= 0) continue;

    const isRecord = currentValue >= record.value;
    const onPace = !isRecord && isLiveView && currentValue >= record.value * 0.8;

    if (isRecord || onPace) {
      const metricLabel = METRIC_LABELS[key] || key;
      result.push({
        metricKey: key,
        label: metricLabel,
        currentValue,
        recordValue: record.value,
        recordDate: record.date,
        recordReps: record.repsWorked,
        isRecord,
        onPace: onPace && !isRecord,
        granularity,
        contextualLabel: generateContextualLabel(metricLabel, granularity, isRecord, onPace && !isRecord, currentDate),
      });
    }
  }

  // For avgStart: lower is better — check if current is earlier
  if (currentTotals.avgStartMinutes !== undefined && records.avgStartMinutes) {
    const currentStart = currentTotals.avgStartMinutes;
    const recordStart = records.avgStartMinutes.value;
    const isRecord = currentStart <= recordStart;
    const onPace = !isRecord && isLiveView && currentStart <= recordStart * 1.05; // within 5%

    if (isRecord || onPace) {
      result.push({
        metricKey: 'avgStartMinutes',
        label: 'Earliest Start',
        currentValue: currentStart,
        recordValue: recordStart,
        recordDate: records.avgStartMinutes.date,
        recordReps: records.avgStartMinutes.repsWorked,
        isRecord,
        onPace: onPace && !isRecord,
        granularity,
        contextualLabel: generateContextualLabel('Avg Start', granularity, isRecord, onPace && !isRecord, currentDate),
      });
    }
  }

  // Day-of-week records (only for daily presets)
  if (granularity === 'daily' && currentDate) {
    const dow = getDay(currentDate);
    const dowRecords = allTimeRecords.dayOfWeek[dow];
    const dowCount = allTimeRecords.periodCounts.dayOfWeek[dow] || 0;
    if (dowRecords && dowCount >= 3) {
      for (const key of metricKeys) {
        const record = dowRecords[key];
        if (!record) continue;
        // Skip if already flagged as an overall daily record
        if (result.some(r => r.metricKey === key && r.isRecord)) continue;

        const currentValue = (currentTotals as any)[key] || 0;
        if (currentValue <= 0) continue;

        const isRecord = currentValue >= record.value;
        if (isRecord) {
          const metricLabel = METRIC_LABELS[key] || key;
          const dowLabel = `Best ${DAY_NAMES[dow]} ${metricLabel}`;
          result.push({
            metricKey: key,
            label: metricLabel,
            currentValue,
            recordValue: record.value,
            recordDate: record.date,
            recordReps: record.repsWorked,
            isRecord: true,
            onPace: false,
            granularity: 'daily',
            dayOfWeekLabel: dowLabel,
            contextualLabel: dowLabel,
          });
        }
      }
    }
  }

  return result;
}

export function formatRecordDate(dateStr: string, granularity: 'daily' | 'weekly' | 'monthly'): string {
  if (granularity === 'monthly') {
    const [y, m] = dateStr.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(m) - 1]} ${y}`;
  }
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return format(d, 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export { DAY_NAMES, GRANULARITY_LABELS, METRIC_LABELS };
