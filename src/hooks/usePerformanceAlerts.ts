import { useMemo } from "react";
import { format, subDays, parseISO, differenceInHours } from "date-fns";

export interface PerformanceAlert {
  id: string;
  type: 'effort-no-results' | 'streak' | 'milestone' | 'attendance' | 'pace-warning';
  severity: 'info' | 'warning' | 'critical';
  repName: string;
  repUserId: string;
  message: string;
  detail?: string;
  timestamp: Date;
}

interface DailyEntryData {
  user_id: string;
  entry_date: string;
  fp_plus: number | null;
  work_start_time: string | null;
  work_end_time: string | null;
  doors_knocked: number | null;
  pitches: number | null;
  transitions: number | null;
  presentations: number | null;
  closes: number | null;
  is_finalized: boolean | null;
}

interface RepInfo {
  userId: string;
  name: string;
  year?: string | null;
}

interface UsePerformanceAlertsParams {
  entries: DailyEntryData[];
  reps: RepInfo[];
  enabled?: boolean;
}

const stripEmojis = (text: string): string =>
  text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();

export const usePerformanceAlerts = ({ entries, reps, enabled = true }: UsePerformanceAlertsParams): PerformanceAlert[] => {
  return useMemo(() => {
    if (!enabled || !entries.length || !reps.length) return [];

    const alerts: PerformanceAlert[] = [];
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const lookbackDays = 7;
    const lookbackStart = format(subDays(new Date(), lookbackDays), 'yyyy-MM-dd');

    const repMap = new Map(reps.map(r => [r.userId, r]));

    // Group entries by user
    const entriesByUser = new Map<string, DailyEntryData[]>();
    for (const entry of entries) {
      if (!entry.user_id || entry.entry_date < lookbackStart) continue;
      if (!entriesByUser.has(entry.user_id)) entriesByUser.set(entry.user_id, []);
      entriesByUser.get(entry.user_id)!.push(entry);
    }

    for (const [userId, userEntries] of entriesByUser) {
      const rep = repMap.get(userId);
      if (!rep) continue;
      const name = stripEmojis(rep.name);

      // Sort by date descending
      const sorted = [...userEntries].sort((a, b) => b.entry_date.localeCompare(a.entry_date));

      // --- Effort without results ---
      // Check for consecutive days with high doors but zero sales
      let effortStreak = 0;
      for (const entry of sorted) {
        const doors = entry.doors_knocked || 0;
        const sales = entry.closes || 0;
        const fp = Number(entry.fp_plus) || 0;
        if (doors >= 30 && sales === 0 && fp === 0) {
          effortStreak++;
        } else {
          break;
        }
      }
      if (effortStreak >= 2) {
        alerts.push({
          id: `effort-${userId}`,
          type: 'effort-no-results',
          severity: effortStreak >= 3 ? 'critical' : 'warning',
          repName: name,
          repUserId: userId,
          message: `${name} has knocked ${effortStreak} days in a row without selling`,
          detail: `${sorted[0]?.doors_knocked || 0} doors yesterday`,
          timestamp: new Date(),
        });
      }

      // --- High doors, zero transitions (skill gap) ---
      const recentEntry = sorted[0];
      if (recentEntry && (recentEntry.entry_date === today || recentEntry.entry_date === yesterday)) {
        const doors = recentEntry.doors_knocked || 0;
        const transitions = recentEntry.transitions || 0;
        if (doors >= 40 && transitions === 0) {
          alerts.push({
            id: `skill-gap-${userId}`,
            type: 'effort-no-results',
            severity: 'warning',
            repName: name,
            repUserId: userId,
            message: `${name} knocked ${doors} doors with zero transitions`,
            detail: 'Possible pitch or approach issue',
            timestamp: new Date(),
          });
        }
      }

      // --- Sales streaks ---
      let salesStreak = 0;
      for (const entry of sorted) {
        const fp = Number(entry.fp_plus) || 0;
        if (fp > 0) {
          salesStreak++;
        } else {
          break;
        }
      }
      if (salesStreak >= 3) {
        alerts.push({
          id: `streak-${userId}`,
          type: 'streak',
          severity: 'info',
          repName: name,
          repUserId: userId,
          message: `🔥 ${name} has sold ${salesStreak} days in a row`,
          timestamp: new Date(),
        });
      }

      // --- Big day milestone (3+ FP in a single day) ---
      if (recentEntry && (recentEntry.entry_date === today || recentEntry.entry_date === yesterday)) {
        const fp = Number(recentEntry.fp_plus) || 0;
        if (fp >= 3) {
          alerts.push({
            id: `milestone-${userId}-${recentEntry.entry_date}`,
            type: 'milestone',
            severity: 'info',
            repName: name,
            repUserId: userId,
            message: `🎉 ${name} had a ${fp.toFixed(1)} FP+ day!`,
            timestamp: new Date(),
          });
        }
      }

      // --- Attendance anomalies ---
      if (recentEntry && recentEntry.entry_date === yesterday && recentEntry.work_end_time) {
        try {
          const endTime = parseISO(recentEntry.work_end_time);
          const startTime = recentEntry.work_start_time ? parseISO(recentEntry.work_start_time) : null;
          
          if (startTime) {
            const hoursWorked = differenceInHours(endTime, startTime);
            if (hoursWorked <= 4 && hoursWorked > 0) {
              alerts.push({
                id: `short-day-${userId}-${recentEntry.entry_date}`,
                type: 'attendance',
                severity: 'warning',
                repName: name,
                repUserId: userId,
                message: `${name} only worked ${hoursWorked}h yesterday`,
                timestamp: new Date(),
              });
            }
          }
        } catch {
          // Skip invalid dates
        }
      }

      // --- Pace warning: no work in 3+ days ---
      if (sorted.length > 0) {
        const lastWorkDate = sorted[0]?.entry_date;
        if (lastWorkDate) {
          const daysSinceWork = Math.floor(
            (new Date().getTime() - new Date(lastWorkDate + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysSinceWork >= 3 && daysSinceWork <= 7) {
            alerts.push({
              id: `inactive-${userId}`,
              type: 'pace-warning',
              severity: daysSinceWork >= 5 ? 'critical' : 'warning',
              repName: name,
              repUserId: userId,
              message: `${name} hasn't worked in ${daysSinceWork} days`,
              timestamp: new Date(),
            });
          }
        }
      }
    }

    // Sort: critical first, then warning, then info
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }, [entries, reps, enabled]);
};
