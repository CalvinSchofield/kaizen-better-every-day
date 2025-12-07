import { useMemo } from "react";
import { LeaderPreseasonStandardsCard } from "./LeaderPreseasonStandardsCard";
import { LeaderGoalsCard } from "./LeaderGoalsCard";
import { TeamSummerAvailabilityCard } from "./TeamSummerAvailabilityCard";
import { useAllRepGoals } from "@/hooks/useRepGoals";
import { useTeamSummerConfig } from "@/hooks/useTeamSummerConfig";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays, parseISO } from "date-fns";

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

  // Fetch preseason FP for goals urgency calculation
  const { data: repsFp } = useQuery({
    queryKey: ['readiness-fp', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('daily_entries')
        .select('user_id, fp_plus, upgrade_prmr')
        .in('user_id', userIds)
        .gte('entry_date', preseasonStartDate)
        .lte('entry_date', now.toISOString().split('T')[0]);
      
      if (error) throw error;
      
      const fpByUser: Record<string, number> = {};
      for (const entry of data || []) {
        const fpPlus = (entry.fp_plus || 0) + ((entry.upgrade_prmr || 0) / 85);
        fpByUser[entry.user_id] = (fpByUser[entry.user_id] || 0) + fpPlus;
      }
      
      return fpByUser;
    },
    enabled: userIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });

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
    // Count reps behind on FP goals
    let goalsBehindCount = 0;
    
    if (allGoals && repsFp) {
      const preseasonStart = parseISO(preseasonStartDate);
      const summerStart = parseISO(summerStartDate);
      const totalDays = differenceInDays(summerStart, preseasonStart);
      const elapsedDays = differenceInDays(now, preseasonStart);
      
      for (const userId of filteredUserIds) {
        const goals = allGoals.find(g => g.user_id === userId);
        if (!goals?.setup_complete) continue;
        
        const preseasonGoal = goals.preseason_fp_goal || 0;
        if (preseasonGoal <= 0) continue;
        
        const currentFp = repsFp[userId] || 0;
        const expectedFp = totalDays > 0 ? (preseasonGoal / totalDays) * elapsedDays : 0;
        
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
  }, [userIds, excludeUserIds, allGoals, repsFp, summerConfigs, isPreseason]);

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
