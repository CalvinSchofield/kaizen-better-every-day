import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getLocalDateString } from "@/lib/utils";

export interface AwardStreak {
  userId: string;
  name: string;
  currentStreak: number;
  awardType: 'earlyBird' | 'nightOwl' | 'ironman' | 'workhorse';
}

// Time thresholds in minutes since midnight
const WEEKDAY_EARLY_CUTOFF = 15 * 60; // 3:00 PM
const SATURDAY_EARLY_CUTOFF = 10 * 60; // 10:00 AM
const NIGHT_OWL_CUTOFF = 19 * 60; // 7:00 PM

const getLocalMinutesOfDay = (timestamp: string, timezone: string): number => {
  try {
    const date = new Date(timestamp);
    const localTime = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).format(date);
    const [hours, minutes] = localTime.split(':').map(Number);
    return hours * 60 + minutes;
  } catch {
    return 0;
  }
};

export const useAwardStreaks = (filterByYear?: string) => {
  return useQuery({
    queryKey: ["award-streaks", filterByYear],
    queryFn: async () => {
      // Get the last 30 days of data
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: repsData, error: repsError } = await supabase
        .from("reps")
        .select("user_id, name, year, timezone");

      if (repsError) throw repsError;

      const repsMap = new Map(repsData?.map(r => [r.user_id, { 
        name: r.name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim(), 
        year: r.year,
        timezone: r.timezone || 'America/Los_Angeles'
      }]) || []);

      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("user_id, entry_date, counter_timestamps, work_start_time, work_end_time, break_periods, timezone, sales_log")
        .gte("entry_date", getLocalDateString(thirtyDaysAgo))
        .lte("entry_date", getLocalDateString(today));

      if (error) throw error;

      let filteredEntries = entries || [];
      if (filterByYear) {
        filteredEntries = filteredEntries.filter(e => repsMap.get(e.user_id)?.year === filterByYear);
      }

      // Group entries by date
      const entriesByDate = new Map<string, typeof filteredEntries>();
      filteredEntries.forEach(entry => {
        const dateEntries = entriesByDate.get(entry.entry_date) || [];
        dateEntries.push(entry);
        entriesByDate.set(entry.entry_date, dateEntries);
      });

      // Sort dates descending (most recent first)
      const sortedDates = Array.from(entriesByDate.keys()).sort((a, b) => b.localeCompare(a));

      // Track streaks per user
      const streaks: Map<string, {
        earlyBird: number;
        nightOwl: number;
        ironman: number;
        workhorse: number;
        earlyBirdBroken: boolean;
        nightOwlBroken: boolean;
        ironmanBroken: boolean;
        workhorseBroken: boolean;
      }> = new Map();

      // Process each date to find winners
      for (const dateStr of sortedDates) {
        const dayEntries = entriesByDate.get(dateStr) || [];
        if (dayEntries.length === 0) continue;

        const dateObj = new Date(dateStr + 'T12:00:00');
        const isSaturday = dateObj.getDay() === 6;
        const earlyCutoff = isSaturday ? SATURDAY_EARLY_CUTOFF : WEEKDAY_EARLY_CUTOFF;

        // Find Early Bird winner for this day
        let earlyBirdWinner: { userId: string; mins: number } | null = null;
        // Find Night Owl winner for this day
        let nightOwlWinner: { userId: string; mins: number } | null = null;
        // Find Workhorse winner for this day
        let workhorseWinner: { userId: string; hours: number } | null = null;

        dayEntries.forEach(entry => {
          const repInfo = repsMap.get(entry.user_id);
          if (!repInfo) return;
          const userTimezone = entry.timezone || repInfo.timezone;

          // Check for earliest action (Early Bird)
          const timestamps = entry.counter_timestamps as any;
          const salesLog = entry.sales_log as any[];
          
          // Helper to check if a sale qualifies as FP+ (type='fp' OR upgrade with prmr >= 85)
          const isFPPlus = (sale: any): boolean => {
            if (sale.install_status === 'never_installed') return false;
            if (sale.type === 'fp') return true;
            if (sale.type === 'upgrade' && Number(sale.prmr) >= 85) return true;
            return false;
          };
          
          // Get all timestamps for early bird check
          const allTimestamps: { ts: string; mins: number }[] = [];
          
          // FP+ timestamps from sales_log (only count actual FP+ sales)
          if (salesLog && Array.isArray(salesLog)) {
            salesLog.forEach(sale => {
              if (sale.timestamp && isFPPlus(sale)) {
                const mins = getLocalMinutesOfDay(sale.timestamp, userTimezone);
                if (mins < earlyCutoff) {
                  allTimestamps.push({ ts: sale.timestamp, mins });
                }
              }
            });
          }
          
          // Activity timestamps
          ['presentations', 'transitions', 'pitches', 'decision_makers', 'doors_knocked'].forEach(key => {
            const arr = timestamps?.[key];
            if (Array.isArray(arr)) {
              arr.forEach((ts: string) => {
                const mins = getLocalMinutesOfDay(ts, userTimezone);
                if (mins < earlyCutoff) {
                  allTimestamps.push({ ts, mins });
                }
              });
            }
          });

          if (allTimestamps.length > 0) {
            const earliest = allTimestamps.reduce((min, curr) => curr.mins < min.mins ? curr : min);
            if (!earlyBirdWinner || earliest.mins < earlyBirdWinner.mins) {
              earlyBirdWinner = { userId: entry.user_id, mins: earliest.mins };
            }
          }

          // Check for latest action (Night Owl)
          const allLateTimestamps: { ts: string; mins: number }[] = [];
          
          // FP+ timestamps from sales_log (only count actual FP+ sales)
          if (salesLog && Array.isArray(salesLog)) {
            salesLog.forEach(sale => {
              if (sale.timestamp && isFPPlus(sale)) {
                const mins = getLocalMinutesOfDay(sale.timestamp, userTimezone);
                if (mins >= NIGHT_OWL_CUTOFF) {
                  allLateTimestamps.push({ ts: sale.timestamp, mins });
                }
              }
            });
          }
          
          ['presentations', 'transitions', 'pitches', 'decision_makers', 'doors_knocked'].forEach(key => {
            const arr = timestamps?.[key];
            if (Array.isArray(arr)) {
              arr.forEach((ts: string) => {
                const mins = getLocalMinutesOfDay(ts, userTimezone);
                if (mins >= NIGHT_OWL_CUTOFF) {
                  allLateTimestamps.push({ ts, mins });
                }
              });
            }
          });

          if (allLateTimestamps.length > 0) {
            const latest = allLateTimestamps.reduce((max, curr) => curr.mins > max.mins ? curr : max);
            if (!nightOwlWinner || latest.mins > nightOwlWinner.mins) {
              nightOwlWinner = { userId: entry.user_id, mins: latest.mins };
            }
          }

          // Calculate hours worked for workhorse
          if (entry.work_start_time && entry.work_end_time) {
            const start = new Date(entry.work_start_time).getTime();
            const end = new Date(entry.work_end_time).getTime();
            let hours = (end - start) / (1000 * 60 * 60);
            
            // Subtract breaks
            const breakPeriods = entry.break_periods as any[];
            if (breakPeriods && Array.isArray(breakPeriods)) {
              breakPeriods.forEach(bp => {
                if (bp.start && bp.end) {
                  const breakStart = new Date(bp.start).getTime();
                  const breakEnd = new Date(bp.end).getTime();
                  hours -= (breakEnd - breakStart) / (1000 * 60 * 60);
                }
              });
            }
            
            if (hours > 0 && (!workhorseWinner || hours > workhorseWinner.hours)) {
              workhorseWinner = { userId: entry.user_id, hours };
            }
          }
        });

        // Update streaks for winners
        repsData?.forEach(rep => {
          const userId = rep.user_id;
          if (!userId) return;
          
          const userStreaks = streaks.get(userId) || {
            earlyBird: 0, nightOwl: 0, ironman: 0, workhorse: 0,
            earlyBirdBroken: false, nightOwlBroken: false, ironmanBroken: false, workhorseBroken: false
          };

          // Early Bird
          if (earlyBirdWinner?.userId === userId && !userStreaks.earlyBirdBroken) {
            userStreaks.earlyBird++;
          } else if (earlyBirdWinner && !userStreaks.earlyBirdBroken) {
            userStreaks.earlyBirdBroken = true;
          }

          // Night Owl
          if (nightOwlWinner?.userId === userId && !userStreaks.nightOwlBroken) {
            userStreaks.nightOwl++;
          } else if (nightOwlWinner && !userStreaks.nightOwlBroken) {
            userStreaks.nightOwlBroken = true;
          }

          // Ironman (both early bird AND night owl on same day)
          const isIronman = earlyBirdWinner?.userId === userId && nightOwlWinner?.userId === userId;
          if (isIronman && !userStreaks.ironmanBroken) {
            userStreaks.ironman++;
          } else if ((earlyBirdWinner || nightOwlWinner) && !userStreaks.ironmanBroken) {
            userStreaks.ironmanBroken = true;
          }

          // Workhorse
          if (workhorseWinner?.userId === userId && !userStreaks.workhorseBroken) {
            userStreaks.workhorse++;
          } else if (workhorseWinner && !userStreaks.workhorseBroken) {
            userStreaks.workhorseBroken = true;
          }

          streaks.set(userId, userStreaks);
        });
      }

      // Find the best streak for each award type
      const findBestStreak = (awardType: 'earlyBird' | 'nightOwl' | 'ironman' | 'workhorse'): AwardStreak | null => {
        let best: AwardStreak | null = null;
        
        streaks.forEach((userStreaks, odUserId) => {
          const count = userStreaks[awardType];
          if (count >= 2) { // Only show streaks of 2+
            const repInfo = repsMap.get(odUserId);
            if (repInfo && (!best || count > best.currentStreak)) {
              best = {
                userId: odUserId,
                name: repInfo.name,
                currentStreak: count,
                awardType
              };
            }
          }
        });
        
        return best;
      };

      return {
        earlyBirdStreak: findBestStreak('earlyBird'),
        nightOwlStreak: findBestStreak('nightOwl'),
        ironmanStreak: findBestStreak('ironman'),
        workhorseStreak: findBestStreak('workhorse'),
        // Also return all streaks for current user lookup
        allStreaks: Object.fromEntries(streaks)
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
