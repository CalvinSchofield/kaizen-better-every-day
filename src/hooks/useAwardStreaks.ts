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

      // Sort dates ASCENDING (oldest first) for proper streak counting
      const sortedDates = Array.from(entriesByDate.keys()).sort((a, b) => a.localeCompare(b));

      // Check if a sale qualifies as FP+ (type='fp' OR upgrade with prmr >= 85)
      const isFPPlus = (sale: any): boolean => {
        if (sale.install_status === 'never_installed') return false;
        if (sale.type === 'fp') return true;
        if (sale.type === 'upgrade' && Number(sale.prmr) >= 85) return true;
        return false;
      };

      // Track streaks per user - process chronologically
      const streaks: Map<string, {
        earlyBird: number;
        nightOwl: number;
        ironman: number;
        workhorse: number;
      }> = new Map();

      // Track the last date where each award had a winner
      // This helps us detect gaps in calendar days
      let lastEarlyBirdDate: string | null = null;
      let lastNightOwlDate: string | null = null;
      let lastIronmanDate: string | null = null;
      let lastWorkhorseDate: string | null = null;

      // Helper to check if two dates are consecutive calendar days
      const areConsecutiveDays = (date1: string | null, date2: string): boolean => {
        if (!date1) return true; // First win starts a streak
        const d1 = new Date(date1 + 'T12:00:00');
        const d2 = new Date(date2 + 'T12:00:00');
        const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays === 1;
      };

      // Process each date chronologically
      for (const dateStr of sortedDates) {
        const dayEntries = entriesByDate.get(dateStr) || [];
        if (dayEntries.length === 0) continue;

        const dateObj = new Date(dateStr + 'T12:00:00');
        const isSaturday = dateObj.getDay() === 6;
        const earlyCutoff = isSaturday ? SATURDAY_EARLY_CUTOFF : WEEKDAY_EARLY_CUTOFF;

        // Find Early Bird winner for this day - FP+ ONLY
        let earlyBirdWinner: { userId: string; mins: number } | null = null;
        // Find Night Owl winner for this day - FP+ ONLY
        let nightOwlWinner: { userId: string; mins: number } | null = null;
        // Find Workhorse winner for this day
        let workhorseWinner: { userId: string; hours: number } | null = null;

        dayEntries.forEach(entry => {
          const repInfo = repsMap.get(entry.user_id);
          if (!repInfo) return;
          const userTimezone = entry.timezone || repInfo.timezone;

          const salesLog = entry.sales_log as any[];
          
          // Early Bird: ONLY count FP+ sales before cutoff
          if (salesLog && Array.isArray(salesLog)) {
            salesLog.forEach(sale => {
              if (sale.timestamp && isFPPlus(sale)) {
                const mins = getLocalMinutesOfDay(sale.timestamp, userTimezone);
                if (mins < earlyCutoff) {
                  if (!earlyBirdWinner || mins < earlyBirdWinner.mins) {
                    earlyBirdWinner = { userId: entry.user_id, mins };
                  }
                }
              }
            });
          }

          // Night Owl: ONLY count FP+ sales after 7 PM
          if (salesLog && Array.isArray(salesLog)) {
            salesLog.forEach(sale => {
              if (sale.timestamp && isFPPlus(sale)) {
                const mins = getLocalMinutesOfDay(sale.timestamp, userTimezone);
                if (mins >= NIGHT_OWL_CUTOFF) {
                  if (!nightOwlWinner || mins > nightOwlWinner.mins) {
                    nightOwlWinner = { userId: entry.user_id, mins };
                  }
                }
              }
            });
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

        // Determine Ironman: same person wins both Early Bird AND Night Owl
        const ironmanWinnerId = earlyBirdWinner && nightOwlWinner && 
          earlyBirdWinner.userId === nightOwlWinner.userId 
          ? earlyBirdWinner.userId 
          : null;

        // Update streaks based on winners
        // For consecutive calendar days rule: if no winner, all streaks reset
        
        // Early Bird streak
        if (earlyBirdWinner) {
          if (areConsecutiveDays(lastEarlyBirdDate, dateStr)) {
            // Continue or start streak for winner
            const winnerStreaks = streaks.get(earlyBirdWinner.userId) || { earlyBird: 0, nightOwl: 0, ironman: 0, workhorse: 0 };
            winnerStreaks.earlyBird++;
            streaks.set(earlyBirdWinner.userId, winnerStreaks);
            
            // Reset all other users' early bird streaks (they lost today)
            streaks.forEach((userStreaks, odUserId) => {
              if (odUserId !== earlyBirdWinner!.userId) {
                userStreaks.earlyBird = 0;
              }
            });
          } else {
            // Gap in calendar days - reset all streaks, start fresh for winner
            streaks.forEach((userStreaks) => {
              userStreaks.earlyBird = 0;
            });
            const winnerStreaks = streaks.get(earlyBirdWinner.userId) || { earlyBird: 0, nightOwl: 0, ironman: 0, workhorse: 0 };
            winnerStreaks.earlyBird = 1;
            streaks.set(earlyBirdWinner.userId, winnerStreaks);
          }
          lastEarlyBirdDate = dateStr;
        } else {
          // No winner today - all early bird streaks break
          streaks.forEach((userStreaks) => {
            userStreaks.earlyBird = 0;
          });
          lastEarlyBirdDate = null;
        }

        // Night Owl streak
        if (nightOwlWinner) {
          if (areConsecutiveDays(lastNightOwlDate, dateStr)) {
            const winnerStreaks = streaks.get(nightOwlWinner.userId) || { earlyBird: 0, nightOwl: 0, ironman: 0, workhorse: 0 };
            winnerStreaks.nightOwl++;
            streaks.set(nightOwlWinner.userId, winnerStreaks);
            
            streaks.forEach((userStreaks, odUserId) => {
              if (odUserId !== nightOwlWinner!.userId) {
                userStreaks.nightOwl = 0;
              }
            });
          } else {
            streaks.forEach((userStreaks) => {
              userStreaks.nightOwl = 0;
            });
            const winnerStreaks = streaks.get(nightOwlWinner.userId) || { earlyBird: 0, nightOwl: 0, ironman: 0, workhorse: 0 };
            winnerStreaks.nightOwl = 1;
            streaks.set(nightOwlWinner.userId, winnerStreaks);
          }
          lastNightOwlDate = dateStr;
        } else {
          streaks.forEach((userStreaks) => {
            userStreaks.nightOwl = 0;
          });
          lastNightOwlDate = null;
        }

        // Ironman streak
        if (ironmanWinnerId) {
          if (areConsecutiveDays(lastIronmanDate, dateStr)) {
            const winnerStreaks = streaks.get(ironmanWinnerId) || { earlyBird: 0, nightOwl: 0, ironman: 0, workhorse: 0 };
            winnerStreaks.ironman++;
            streaks.set(ironmanWinnerId, winnerStreaks);
            
            streaks.forEach((userStreaks, odUserId) => {
              if (odUserId !== ironmanWinnerId) {
                userStreaks.ironman = 0;
              }
            });
          } else {
            streaks.forEach((userStreaks) => {
              userStreaks.ironman = 0;
            });
            const winnerStreaks = streaks.get(ironmanWinnerId) || { earlyBird: 0, nightOwl: 0, ironman: 0, workhorse: 0 };
            winnerStreaks.ironman = 1;
            streaks.set(ironmanWinnerId, winnerStreaks);
          }
          lastIronmanDate = dateStr;
        } else {
          streaks.forEach((userStreaks) => {
            userStreaks.ironman = 0;
          });
          lastIronmanDate = null;
        }

        // Workhorse streak
        if (workhorseWinner) {
          if (areConsecutiveDays(lastWorkhorseDate, dateStr)) {
            const winnerStreaks = streaks.get(workhorseWinner.userId) || { earlyBird: 0, nightOwl: 0, ironman: 0, workhorse: 0 };
            winnerStreaks.workhorse++;
            streaks.set(workhorseWinner.userId, winnerStreaks);
            
            streaks.forEach((userStreaks, odUserId) => {
              if (odUserId !== workhorseWinner!.userId) {
                userStreaks.workhorse = 0;
              }
            });
          } else {
            streaks.forEach((userStreaks) => {
              userStreaks.workhorse = 0;
            });
            const winnerStreaks = streaks.get(workhorseWinner.userId) || { earlyBird: 0, nightOwl: 0, ironman: 0, workhorse: 0 };
            winnerStreaks.workhorse = 1;
            streaks.set(workhorseWinner.userId, winnerStreaks);
          }
          lastWorkhorseDate = dateStr;
        } else {
          streaks.forEach((userStreaks) => {
            userStreaks.workhorse = 0;
          });
          lastWorkhorseDate = null;
        }
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
