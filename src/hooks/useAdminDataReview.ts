import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const ADMIN_EMAIL = 'calvinjschofield@gmail.com';

export interface DataIssue {
  id: string;
  entryId: string;
  repName: string;
  repId: string;
  issueType: 'unsaved' | 'late_end_time' | 'late_save' | 'abnormal_metric' | 'impossible_ratio';
  description: string;
  severity: 'warning' | 'error';
  entryDate: string;
  entryData: {
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
    counter_timestamps: Record<string, string[]> | null;
    is_finalized: boolean;
    timezone: string | null;
  };
}

const DISMISSED_KEY = 'admin-data-review-dismissed';

export const useAdminDataReview = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [dismissedIssues, setDismissedIssues] = useState<string[]>([]);
  const [isAfter10PM, setIsAfter10PM] = useState(false);

  // Check if admin
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAdmin(user?.email === ADMIN_EMAIL);
    };
    checkAdmin();
  }, []);

  // Load dismissed issues from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(DISMISSED_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Only keep dismissals from today
        const today = new Date().toISOString().split('T')[0];
        if (parsed.date === today) {
          setDismissedIssues(parsed.issues || []);
        } else {
          // Clear old dismissals
          localStorage.removeItem(DISMISSED_KEY);
        }
      } catch {
        localStorage.removeItem(DISMISSED_KEY);
      }
    }
  }, []);

  // Check time
  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      const hour = now.getHours();
      setIsAfter10PM(hour >= 22 || hour < 6); // 10 PM to 6 AM
    };
    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Get date range for checking (last 3 days to catch all forgotten entries)
  const getDateRange = () => {
    const today = new Date();
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    return {
      today: today.toISOString().split('T')[0],
      threeDaysAgo: threeDaysAgo.toISOString().split('T')[0],
    };
  };

  // Fetch recent entries and analyze for issues
  const { data: issues = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-data-review', isAdmin],
    queryFn: async () => {
      if (!isAdmin) return [];

      const { today, threeDaysAgo } = getDateRange();

      // Fetch all entries from last 3 days (excluding today)
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('*')
        .gte('entry_date', threeDaysAgo)
        .lt('entry_date', today);

      if (error) {
        console.error('Error fetching entries for review:', error);
        return [];
      }

      // Fetch rep names
      const { data: reps } = await supabase.from('reps').select('user_id, name, timezone');
      const repMap = new Map(reps?.map(r => [r.user_id, { name: r.name, timezone: r.timezone }]) || []);

      // Fetch historical averages for comparison
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: historicalEntries } = await supabase
        .from('daily_entries')
        .select('user_id, pitches, doors_knocked, presentations, closes')
        .gte('entry_date', thirtyDaysAgo.toISOString().split('T')[0])
        .lt('entry_date', threeDaysAgo)
        .eq('is_finalized', true);

      // Calculate averages per user
      const userAverages = new Map<string, { pitches: number; doors: number; presentations: number; count: number }>();
      historicalEntries?.forEach(e => {
        const existing = userAverages.get(e.user_id) || { pitches: 0, doors: 0, presentations: 0, count: 0 };
        userAverages.set(e.user_id, {
          pitches: existing.pitches + (e.pitches || 0),
          doors: existing.doors + (e.doors_knocked || 0),
          presentations: existing.presentations + (e.presentations || 0),
          count: existing.count + 1,
        });
      });

      // Calculate team averages for reps without history
      let teamTotalPitches = 0, teamTotalDoors = 0, teamTotalPres = 0, teamCount = 0;
      userAverages.forEach(avg => {
        if (avg.count >= 3) {
          teamTotalPitches += avg.pitches / avg.count;
          teamTotalDoors += avg.doors / avg.count;
          teamTotalPres += avg.presentations / avg.count;
          teamCount++;
        }
      });
      const teamAvgPitches = teamCount > 0 ? teamTotalPitches / teamCount : 20;
      const teamAvgDoors = teamCount > 0 ? teamTotalDoors / teamCount : 50;

      const detectedIssues: DataIssue[] = [];

      for (const entry of entries || []) {
        const rep = repMap.get(entry.user_id);
        if (!rep) continue;

        const entryData = {
          doors_knocked: entry.doors_knocked || 0,
          decision_makers: entry.decision_makers || 0,
          pitches: entry.pitches || 0,
          transitions: entry.transitions || 0,
          presentations: entry.presentations || 0,
          closes: entry.closes || 0,
          fp_plus: entry.fp_plus || 0,
          prmr: entry.prmr || 0,
          upgrade_prmr: entry.upgrade_prmr || 0,
          work_start_time: entry.work_start_time,
          work_end_time: entry.work_end_time,
          counter_timestamps: entry.counter_timestamps as Record<string, string[]> | null,
          is_finalized: entry.is_finalized || false,
          timezone: rep.timezone || entry.timezone || null,
        };

        const hasActivity = entryData.doors_knocked > 0 || entryData.pitches > 0 || 
                          entryData.presentations > 0 || entryData.closes > 0;

        // Issue 1: Unsaved entry with activity
        if (!entry.is_finalized && hasActivity) {
          detectedIssues.push({
            id: `unsaved-${entry.id}`,
            entryId: entry.id,
            repName: rep.name,
            repId: entry.user_id,
            issueType: 'unsaved',
            description: `Didn't save: ${entryData.doors_knocked} doors, ${entryData.pitches} pitches`,
            severity: 'error',
            entryDate: entry.entry_date,
            entryData,
          });
        }

        // Issue 2: Late end time vs last timestamp
        if (entry.is_finalized && entryData.work_end_time && entryData.counter_timestamps) {
          const allTimestamps: string[] = [];
          Object.values(entryData.counter_timestamps).forEach((arr: string[]) => {
            if (Array.isArray(arr)) allTimestamps.push(...arr);
          });
          
          if (allTimestamps.length > 0) {
            const latestTimestamp = new Date(Math.max(...allTimestamps.map(t => new Date(t).getTime())));
            const endTime = new Date(entryData.work_end_time);
            const hoursDiff = (endTime.getTime() - latestTimestamp.getTime()) / (1000 * 60 * 60);
            
            if (hoursDiff > 2) {
              detectedIssues.push({
                id: `late-end-${entry.id}`,
                entryId: entry.id,
                repName: rep.name,
                repId: entry.user_id,
                issueType: 'late_end_time',
                description: `End time ${hoursDiff.toFixed(1)}h after last activity`,
                severity: 'warning',
                entryDate: entry.entry_date,
                entryData,
              });
            }
          }
        }

        // Issue 3: Abnormal metrics (pitches way higher than average)
        const userAvg = userAverages.get(entry.user_id);
        const avgPitches = userAvg && userAvg.count >= 3 
          ? userAvg.pitches / userAvg.count 
          : teamAvgPitches;
        const avgDoors = userAvg && userAvg.count >= 3
          ? userAvg.doors / userAvg.count
          : teamAvgDoors;

        if (entryData.pitches > avgPitches * 2.5 && entryData.pitches > 10) {
          detectedIssues.push({
            id: `high-pitches-${entry.id}`,
            entryId: entry.id,
            repName: rep.name,
            repId: entry.user_id,
            issueType: 'abnormal_metric',
            description: `${entryData.pitches} pitches (avg: ${avgPitches.toFixed(0)})`,
            severity: 'warning',
            entryDate: entry.entry_date,
            entryData,
          });
        }

        // Issue 4: Impossible ratios (closes > presentations)
        if (entryData.closes > entryData.presentations && entryData.closes > 0) {
          detectedIssues.push({
            id: `impossible-ratio-${entry.id}`,
            entryId: entry.id,
            repName: rep.name,
            repId: entry.user_id,
            issueType: 'impossible_ratio',
            description: `${entryData.closes} closes but only ${entryData.presentations} presentations`,
            severity: 'error',
            entryDate: entry.entry_date,
            entryData,
          });
        }
      }

      return detectedIssues;
    },
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Filter out dismissed issues
  const activeIssues = issues.filter(issue => !dismissedIssues.includes(issue.id));

  const dismissIssue = useCallback((issueId: string) => {
    setDismissedIssues(prev => {
      const updated = [...prev, issueId];
      // Save to localStorage with today's date
      localStorage.setItem(DISMISSED_KEY, JSON.stringify({
        date: new Date().toISOString().split('T')[0],
        issues: updated,
      }));
      return updated;
    });
  }, []);

  const shouldShowCard = isAdmin && (isAfter10PM || activeIssues.length > 0) && activeIssues.length > 0;

  return {
    issues: activeIssues,
    isLoading,
    isAdmin,
    isAfter10PM,
    shouldShowCard,
    dismissIssue,
    refetch,
  };
};

