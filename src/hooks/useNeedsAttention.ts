import { useMemo } from "react";
import { Recruit, RecruitActivity } from "./useGroupRecruits";
import { differenceInDays, parseISO, addDays } from "date-fns";

export interface AttentionCategory {
  id: string;
  label: string;
  emoji: string;
  count: number;
  recruits: AttentionRecruit[];
  priority: number;
}

export interface AttentionRecruit {
  recruit: Recruit;
  reason: string;
  urgency: 'high' | 'medium' | 'low';
  daysUntilBlitz?: number;
  daysSinceContact?: number;
  missingItems?: string[];
}

interface BlitzEvent {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
}

export const useNeedsAttention = (
  recruits: Recruit[],
  activities: RecruitActivity[],
  blitzes: BlitzEvent[]
) => {
  return useMemo(() => {
    if (!recruits.length) {
      return {
        categories: [],
        topPriority: null,
        totalCount: 0,
      };
    }

    const now = new Date();
    const categories: AttentionCategory[] = [];

    // Build last contact map
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

    // 1. Blitz Prep - recruits with upcoming blitz but missing readiness
    const blitzPrepRecruits: AttentionRecruit[] = [];
    
    // Find upcoming blitzes within 21 days
    const upcomingBlitzes = blitzes.filter(b => {
      const blitzDate = parseISO(b.date);
      const daysUntil = differenceInDays(blitzDate, now);
      return daysUntil >= 0 && daysUntil <= 21;
    });

    if (upcomingBlitzes.length > 0) {
      // Find signed/shadow recruits who might need blitz prep
      const signedRecruits = recruits.filter(r => 
        r.stage === 'Signed' || r.stage === 'Shadow ✅'
      );

      signedRecruits.forEach(recruit => {
        // Check if recruit is a rookie (likely needs more prep)
        const isRookie = recruit.year === 'Rookie' || recruit.year === '2025';
        
        if (isRookie) {
          const nearestBlitz = upcomingBlitzes[0];
          const daysUntilBlitz = differenceInDays(parseISO(nearestBlitz.date), now);
          
          blitzPrepRecruits.push({
            recruit,
            reason: `${nearestBlitz.name} in ${daysUntilBlitz} days`,
            urgency: daysUntilBlitz <= 7 ? 'high' : daysUntilBlitz <= 14 ? 'medium' : 'low',
            daysUntilBlitz,
          });
        }
      });
    }

    if (blitzPrepRecruits.length > 0) {
      categories.push({
        id: 'blitz-prep',
        label: 'Blitz Prep',
        emoji: '🔥',
        count: blitzPrepRecruits.length,
        recruits: blitzPrepRecruits.sort((a, b) => (a.daysUntilBlitz || 99) - (b.daysUntilBlitz || 99)),
        priority: 100,
      });
    }

    // 2. Stale Contacts - haven't been contacted in 7+ days (stage-dependent)
    const staleRecruits: AttentionRecruit[] = [];
    
    recruits.forEach(recruit => {
      // Skip certain stages
      if (recruit.stage === 'Not Interested' || recruit.stage === 'Signed but Not Interested') {
        return;
      }

      const lastContact = lastContactMap.get(recruit.notionPageId);
      const daysSince = lastContact ? differenceInDays(now, lastContact) : null;

      // Different thresholds by stage
      const thresholds: Record<string, number> = {
        'Signed': 7,
        'Shadow ✅': 7,
        'Evaluating': 5,
        '100 List': 14,
        'Reached Out': 7,
        'Reached out': 7,
        'Sold 💲': 14,
        'Sold (5+) 💰': 14,
      };

      const threshold = thresholds[recruit.stage] || 7;

      if (daysSince === null || daysSince >= threshold) {
        staleRecruits.push({
          recruit,
          reason: daysSince === null ? 'Never contacted' : `${daysSince}d since contact`,
          urgency: daysSince === null ? 'high' : daysSince >= 14 ? 'high' : 'medium',
          daysSinceContact: daysSince || undefined,
        });
      }
    });

    if (staleRecruits.length > 0) {
      categories.push({
        id: 'stale-contacts',
        label: 'Needs Contact',
        emoji: '🕐',
        count: staleRecruits.length,
        recruits: staleRecruits.sort((a, b) => {
          // Never contacted first, then by days since contact
          if (a.daysSinceContact === undefined) return -1;
          if (b.daysSinceContact === undefined) return 1;
          return b.daysSinceContact - a.daysSinceContact;
        }),
        priority: 80,
      });
    }

    // 3. No Commitment - Signed reps without blitz commitment (simplified check)
    const noCommitmentRecruits: AttentionRecruit[] = [];
    
    const signedWithoutCommitment = recruits.filter(r => 
      (r.stage === 'Signed' || r.stage === 'Shadow ✅') &&
      (r.year === 'Rookie' || r.year === '2025')
    );

    // For simplicity, flag all signed rookies as potentially needing commitment check
    // In real implementation, you'd check their committed_blitzes from reps table
    signedWithoutCommitment.forEach(recruit => {
      noCommitmentRecruits.push({
        recruit,
        reason: 'Check blitz commitment',
        urgency: 'medium',
      });
    });

    if (noCommitmentRecruits.length > 0) {
      categories.push({
        id: 'no-commitment',
        label: 'No Blitz',
        emoji: '⚠️',
        count: noCommitmentRecruits.length,
        recruits: noCommitmentRecruits,
        priority: 60,
      });
    }

    // 4. Hot Leads - Evaluating stage recruits
    const hotLeadRecruits: AttentionRecruit[] = [];
    
    recruits.filter(r => r.stage === 'Evaluating').forEach(recruit => {
      const lastContact = lastContactMap.get(recruit.notionPageId);
      const daysSince = lastContact ? differenceInDays(now, lastContact) : null;

      hotLeadRecruits.push({
        recruit,
        reason: daysSince !== null ? `${daysSince}d ago` : 'Ready to close',
        urgency: daysSince === null || daysSince >= 3 ? 'high' : 'medium',
        daysSinceContact: daysSince || undefined,
      });
    });

    if (hotLeadRecruits.length > 0) {
      categories.push({
        id: 'hot-leads',
        label: 'Hot Leads',
        emoji: '🔥',
        count: hotLeadRecruits.length,
        recruits: hotLeadRecruits.sort((a, b) => (a.daysSinceContact || 99) - (b.daysSinceContact || 99)),
        priority: 90,
      });
    }

    // Sort categories by priority
    categories.sort((a, b) => b.priority - a.priority);

    // Get top priority recruit across all categories
    let topPriority: AttentionRecruit | null = null;
    for (const category of categories) {
      if (category.recruits.length > 0) {
        const topInCategory = category.recruits.find(r => r.urgency === 'high') || category.recruits[0];
        if (!topPriority || (topInCategory.urgency === 'high' && topPriority.urgency !== 'high')) {
          topPriority = topInCategory;
        }
        break; // Just use highest priority category
      }
    }

    const totalCount = categories.reduce((sum, cat) => sum + cat.count, 0);

    return {
      categories,
      topPriority,
      totalCount,
    };
  }, [recruits, activities, blitzes]);
};
