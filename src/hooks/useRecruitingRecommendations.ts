import { useMemo } from "react";
import { Recruit, RecruitActivity } from "./useGroupRecruits";
import { differenceInDays, parseISO } from "date-fns";

export interface RecruitRecommendation {
  recruit: Recruit;
  priority: number;
  reason: string;
  reasonBadge: 'signed' | 'hot-lead' | 'pipeline' | 'stale' | 'overdue';
  daysSinceContact: number | null;
}

// Stage-based cadence rules (days between contacts)
const STAGE_CADENCE: Record<string, number> = {
  'Signed': 7,           // Weekly check-ins
  'Shadow ✅': 7,        // Weekly check-ins
  'Sold 💲': 14,         // Bi-weekly
  'Sold (5+) 💰': 14,    // Bi-weekly
  'Evaluating': 3,       // Hot leads need frequent contact
  'Reached Out': 5,      // Follow up within a week
  'Reached out': 5,
  '100 List': 14,        // Pipeline building, lower priority
};

export const useRecruitingRecommendations = (
  recruits: Recruit[],
  activities: RecruitActivity[]
) => {
  return useMemo(() => {
    if (!recruits.length) return [];

    const now = new Date();
    const recommendations: RecruitRecommendation[] = [];

    // Build a map of latest activity per recruit
    const lastContactMap = new Map<string, Date>();
    activities.forEach(activity => {
      if (activity.activity_type === 'phone_call' || activity.activity_type === 'in_person') {
        const existing = lastContactMap.get(activity.rep_notion_page_id);
        const activityDate = parseISO(activity.created_at);
        if (!existing || activityDate > existing) {
          lastContactMap.set(activity.rep_notion_page_id, activityDate);
        }
      }
    });

    recruits.forEach(recruit => {
      const lastContact = lastContactMap.get(recruit.notionPageId);
      const daysSinceContact = lastContact 
        ? differenceInDays(now, lastContact)
        : null;
      
      const cadence = STAGE_CADENCE[recruit.stage] || 7;
      let priority = 0;
      let reason = '';
      let reasonBadge: RecruitRecommendation['reasonBadge'] = 'pipeline';

      // Check if this recruit is a "rookie" (year === 'Rookie' or similar indicator)
      const isRookie = recruit.year === 'Rookie' || recruit.year === '2025';
      const firstName = recruit.name?.split(' ')[0] || 'Recruit';

      // Tier 1: Signed reps (highest priority) - rookies get higher priority within signed
      if (recruit.stage === 'Signed' || recruit.stage === 'Shadow ✅') {
        if (daysSinceContact === null || daysSinceContact >= 7) {
          // Rookies get +50 priority boost within signed tier
          const rookieBoost = isRookie ? 50 : 0;
          priority = 100 + rookieBoost - (daysSinceContact || 30); // More overdue = higher priority
          reason = isRookie 
            ? `Check in with ${firstName}—weekly rookie touch base` 
            : `Weekly check-in with ${firstName}`;
          reasonBadge = 'signed';
        }
      }
      // Tier 2: Evaluating (hot leads)
      else if (recruit.stage === 'Evaluating') {
        if (daysSinceContact === null || daysSinceContact >= 3) {
          priority = 80 - (daysSinceContact || 20);
          reason = daysSinceContact !== null 
            ? `${firstName} is hot—${daysSinceContact}d since contact, follow up!`
            : `${firstName} is evaluating—reach out and close!`;
          reasonBadge = 'hot-lead';
        }
      }
      // Tier 3: 100 List (never contacted)
      else if (recruit.stage === '100 List' && daysSinceContact === null) {
        priority = 40;
        reason = `Time to reach out to ${firstName}`;
        reasonBadge = 'pipeline';
      }
      // Tier 4: Stale contacts (any stage, 14+ days)
      else if (daysSinceContact !== null && daysSinceContact >= 14) {
        priority = 20 + Math.min(daysSinceContact, 30);
        reason = `${firstName} needs attention—${daysSinceContact}d since contact`;
        reasonBadge = 'stale';
      }
      // Tier 5: Overdue based on cadence
      else if (daysSinceContact !== null && daysSinceContact >= cadence) {
        priority = 30;
        reason = `Follow up with ${firstName}—${daysSinceContact}d since last contact`;
        reasonBadge = 'overdue';
      }

      if (priority > 0) {
        recommendations.push({
          recruit,
          priority,
          reason,
          reasonBadge,
          daysSinceContact,
        });
      }
    });

    // Sort by priority (highest first)
    return recommendations.sort((a, b) => b.priority - a.priority);
  }, [recruits, activities]);
};
