import { useMemo } from "react";
import { LeaderPreseasonStandardsCard } from "./LeaderPreseasonStandardsCard";
import { LeaderGoalsCard } from "./LeaderGoalsCard";
import { TeamSummerAvailabilityCard } from "./TeamSummerAvailabilityCard";
import { useAllRepGoals } from "@/hooks/useRepGoals";
import { useTeamSummerConfig } from "@/hooks/useTeamSummerConfig";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays, parseISO, isAfter, isBefore, eachDayOfInterval, format } from "date-fns";

interface ReportsReadinessTabProps {
  userIds: string[];
  excludeUserIds: string[];
  accessibleReps: any[];
  accessLevel?: 'area_director' | 'mgmt_group_lead' | 'team_lead' | 'none';
}

// Card types for dynamic ordering
type CardType = 'preseason' | 'goals' | 'availability';

interface CardWithUrgency {
  type: CardType;
  urgencyScore: number; // Higher = more urgent
  label: string;
}

export const ReportsReadinessTab = ({
  userIds,
  excludeUserIds,
  accessibleReps,
  accessLevel = 'none',
}: ReportsReadinessTabProps) => {
  const { data: allGoals } = useAllRepGoals();
  const { data: summerConfigs } = useTeamSummerConfig();
  
  const preseasonStartDate = '2025-09-28';
  const summerStartDate = '2026-04-12';
  const now = new Date();
  const isPreseason = now < parseISO(summerStartDate);

  // Fetch preseason FP and worked days for goals urgency calculation
  const { data: repsFpData } = useQuery({
    queryKey: ['readiness-fp-worked', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return { fpByUser: {}, workedDaysByUser: {} };
      
      const { data, error } = await supabase
        .from('daily_entries')
        .select('user_id, fp_plus, upgrade_prmr, doors_knocked, work_start_time, work_end_time')
        .in('user_id', userIds)
        .gte('entry_date', preseasonStartDate)
        .lte('entry_date', now.toISOString().split('T')[0]);
      
      if (error) throw error;
      
      const fpByUser: Record<string, number> = {};
      const workedDaysByUser: Record<string, number> = {};
      
      for (const entry of data || []) {
        const fpPlus = (entry.fp_plus || 0) + ((entry.upgrade_prmr || 0) / 85);
        fpByUser[entry.user_id] = (fpByUser[entry.user_id] || 0) + fpPlus;
        
        // Count real knocking days
        const isRealWorkDay = (entry.doors_knocked || 0) >= 10 || 
                              (entry.work_start_time && entry.work_end_time);
        if (isRealWorkDay) {
          workedDaysByUser[entry.user_id] = (workedDaysByUser[entry.user_id] || 0) + 1;
        }
      }
      
      return { fpByUser, workedDaysByUser };
    },
    enabled: userIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch planned work days
  const { data: allPlannedDays } = useQuery({
    queryKey: ['readiness-planned-days', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('planned_work_days')
        .select('user_id, planned_date')
        .in('user_id', userIds);
      
      if (error) throw error;
      
      const plannedByUser: Record<string, string[]> = {};
      for (const row of data || []) {
        if (!plannedByUser[row.user_id]) {
          plannedByUser[row.user_id] = [];
        }
        plannedByUser[row.user_id].push(row.planned_date);
      }
      return plannedByUser;
    },
    enabled: userIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch blitz commitments
  const { data: repsBlitzData } = useQuery({
    queryKey: ['readiness-blitz-commitments', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('reps')
        .select('user_id, committed_blitzes')
        .in('user_id', userIds);
      
      if (error) throw error;
      
      const blitzByUser: Record<string, any[]> = {};
      for (const row of data || []) {
        blitzByUser[row.user_id] = (row.committed_blitzes as any[]) || [];
      }
      return blitzByUser;
    },
    enabled: userIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Helper to calculate expected FP using planned work days (same logic as LeaderGoalsCard)
  const getExpectedFpByWorkDays = (userId: string, goal: number): number => {
    if (!goal || goal <= 0) return 0;
    
    const seasonStart = parseISO(preseasonStartDate);
    const seasonEnd = parseISO(summerStartDate);
    const today = new Date();
    
    // Get worked days (past)
    const workedDays = repsFpData?.workedDaysByUser[userId] || 0;
    
    // Get planned days (future, within season)
    const plannedDates = allPlannedDays?.[userId] || [];
    const futurePlannedDays = plannedDates.filter(d => {
      const date = parseISO(d);
      return isAfter(date, today) && !isAfter(date, seasonEnd) && !isBefore(date, seasonStart);
    }).length;
    
    // Get blitz days (future, within season, Mon-Sat only)
    const blitzes = repsBlitzData?.[userId] || [];
    let blitzDays = 0;
    
    for (const blitz of blitzes) {
      if (!blitz.startDate || !blitz.endDate) continue;
      try {
        const blitzStart = parseISO(blitz.startDate);
        const blitzEnd = parseISO(blitz.endDate);
        const effectiveStart = isAfter(blitzStart, today) ? blitzStart : 
                               isAfter(today, blitzEnd) ? null : today;
        if (!effectiveStart) continue;
        const effectiveEnd = isAfter(blitzEnd, seasonEnd) ? seasonEnd : blitzEnd;
        if (!isBefore(effectiveStart, effectiveEnd)) continue;
        const days = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd });
        blitzDays += days.filter(d => d.getDay() !== 0).length;
      } catch { /* skip */ }
    }
    
    const totalFutureDays = Math.max(futurePlannedDays, blitzDays);
    const totalDays = workedDays + totalFutureDays;
    
    if (totalDays <= 0) {
      // Fallback to linear if no planned days
      const totalCalendarDays = differenceInDays(seasonEnd, seasonStart);
      const daysElapsed = differenceInDays(today, seasonStart);
      if (totalCalendarDays <= 0 || daysElapsed <= 0) return 0;
      return (goal / totalCalendarDays) * daysElapsed;
    }
    
    const dailyExpected = goal / totalDays;
    return dailyExpected * workedDays;
  };

  // Calculate urgency scores for each card type
  const cardOrder = useMemo(() => {
    const filteredUserIds = userIds.filter(id => !excludeUserIds.includes(id));
    
    // === PRESEASON STANDARDS URGENCY ===
    // Count reps behind on preseason commitments
    let preseasonBehindCount = 0;
    
    if (allGoals && isPreseason) {
      const now = new Date();
      const preseasonStart = parseISO(preseasonStartDate);
      const summerStart = parseISO(summerStartDate);
      const totalPreseasonDays = differenceInDays(summerStart, preseasonStart);
      const elapsedDays = differenceInDays(now, preseasonStart);
      const progressPercent = totalPreseasonDays > 0 ? (elapsedDays / totalPreseasonDays) * 100 : 0;
      
      for (const userId of filteredUserIds) {
        const goals = allGoals.find(g => g.user_id === userId);
        if (!goals?.setup_complete) continue;
        
        // Check each commitment type
        const commitments = [
          { current: goals.training_hours_progress || 0, goal: goals.training_hours_goal || 0 },
          { current: goals.books_progress || 0, goal: goals.books_goal || 0 },
          { current: goals.role_plays_progress || 0, goal: goals.role_plays_goal || 0 },
          { current: goals.monday_night_lights_progress || 0, goal: goals.monday_night_lights_progress || 0 },
          { current: goals.blitzes_progress || 0, goal: goals.blitzes_goal || 0 },
        ];
        
        for (const c of commitments) {
          if (c.goal > 0) {
            const expectedProgress = (c.goal * progressPercent) / 100;
            if (c.current < expectedProgress * 0.9) {
              preseasonBehindCount++;
              break; // Count rep once even if behind on multiple
            }
          }
        }
      }
    }

    // === GOALS URGENCY ===
    // Count reps behind on FP goals using planned work days logic
    let goalsBehindCount = 0;
    
    if (allGoals && repsFpData) {
      for (const userId of filteredUserIds) {
        const goals = allGoals.find(g => g.user_id === userId);
        if (!goals?.setup_complete) continue;
        
        const preseasonGoal = goals.preseason_fp_goal || 0;
        if (preseasonGoal <= 0) continue;
        
        const currentFp = repsFpData.fpByUser[userId] || 0;
        const expectedFp = getExpectedFpByWorkDays(userId, preseasonGoal);
        
        if (expectedFp > 0 && currentFp < expectedFp * 0.9) {
          goalsBehindCount++;
        }
      }
    }

    // === AVAILABILITY URGENCY ===
    // Count reps missing summer dates
    let availabilityMissingCount = 0;
    
    if (summerConfigs) {
      for (const config of summerConfigs) {
        if (filteredUserIds.includes(config.userId)) {
          if (!config.personalSummerStart || !config.personalSummerEnd) {
            availabilityMissingCount++;
          }
        }
      }
    }

    // Build card list with urgency scores
    const cards: CardWithUrgency[] = [
      { 
        type: 'preseason', 
        urgencyScore: preseasonBehindCount,
        label: `${preseasonBehindCount} behind`
      },
      { 
        type: 'goals', 
        urgencyScore: goalsBehindCount,
        label: `${goalsBehindCount} behind`
      },
      { 
        type: 'availability', 
        urgencyScore: availabilityMissingCount,
        label: `${availabilityMissingCount} missing dates`
      },
    ];

    // Sort by urgency (highest first)
    return cards.sort((a, b) => b.urgencyScore - a.urgencyScore);
  }, [userIds, excludeUserIds, allGoals, repsFpData, allPlannedDays, repsBlitzData, summerConfigs, isPreseason]);

  // Store urgency counts for passing to cards
  const urgencyCounts = useMemo(() => ({
    preseason: cardOrder.find(c => c.type === 'preseason')?.urgencyScore || 0,
    goals: cardOrder.find(c => c.type === 'goals')?.urgencyScore || 0,
    availability: cardOrder.find(c => c.type === 'availability')?.urgencyScore || 0,
  }), [cardOrder]);

  // Render card based on type
  const renderCard = (cardType: CardType) => {
    switch (cardType) {
      case 'preseason':
        return (
          <LeaderPreseasonStandardsCard
            key="preseason"
            accessibleReps={accessibleReps}
            excludeUserIds={excludeUserIds}
            accessLevel={accessLevel}
          />
        );
      case 'goals':
        return (
          <LeaderGoalsCard
            key="goals"
            userIds={userIds}
            excludeUserIds={excludeUserIds}
            accessibleReps={accessibleReps}
            urgencyBadgeCount={urgencyCounts.goals}
          />
        );
      case 'availability':
        return <TeamSummerAvailabilityCard key="availability" urgencyBadgeCount={urgencyCounts.availability} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {cardOrder.map(card => renderCard(card.type))}
    </div>
  );
};
