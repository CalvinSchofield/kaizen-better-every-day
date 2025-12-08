import { useMemo } from "react";
import { Recruit, RecruitActivity } from "./useGroupRecruits";
import { differenceInDays, parseISO } from "date-fns";

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
  onboardingStatus?: string;
  trainingProgress?: {
    onboardingComplete: boolean;
    trainingsComplete: boolean;
    slackJoined: boolean;
    ipadAssigned: boolean;
    rampPhase: string;
  };
}

interface BlitzEvent {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
}

export interface RepData {
  notion_page_id: string;
  onboarding_complete: boolean | null;
  trainings_complete: boolean | null;
  slack_joined: boolean | null;
  ipad_assigned: boolean | null;
  ramp_to_blitz_phase: string | null;
  committed_blitzes: any;
}

export const useNeedsAttention = (
  recruits: Recruit[],
  activities: RecruitActivity[],
  blitzes: BlitzEvent[],
  repDataMap?: Map<string, RepData>
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

    // Find upcoming blitzes within 21 days
    const upcomingBlitzes = blitzes.filter(b => {
      const blitzDate = parseISO(b.date);
      const daysUntil = differenceInDays(blitzDate, now);
      return daysUntil >= 0 && daysUntil <= 21;
    });

    // 1. Training Progress - Signed recruits with incomplete training/onboarding
    const trainingRecruits: AttentionRecruit[] = [];
    
    if (repDataMap) {
      const signedRecruits = recruits.filter(r => 
        r.stage === 'Signed' || r.stage === 'Shadow ✅'
      );

      signedRecruits.forEach(recruit => {
        const repData = repDataMap.get(recruit.notionPageId);
        if (!repData) return;

        const onboardingComplete = repData.onboarding_complete ?? false;
        const trainingsComplete = repData.trainings_complete ?? false;
        const slackJoined = repData.slack_joined ?? false;
        const ipadAssigned = repData.ipad_assigned ?? false;
        const rampPhase = repData.ramp_to_blitz_phase || 'Not started';

        const missingItems: string[] = [];
        if (!onboardingComplete) missingItems.push('Onboarding');
        if (!trainingsComplete) missingItems.push('Trainings');
        if (!slackJoined) missingItems.push('Slack');
        if (!ipadAssigned) missingItems.push('iPad');

        // Only add if something is missing
        if (missingItems.length > 0) {
          // Check if they have an upcoming blitz
          const hasUpcomingBlitz = upcomingBlitzes.length > 0;
          const nearestBlitz = hasUpcomingBlitz ? upcomingBlitzes[0] : null;
          const daysUntilBlitz = nearestBlitz ? differenceInDays(parseISO(nearestBlitz.date), now) : undefined;

          trainingRecruits.push({
            recruit,
            reason: missingItems.length === 1 
              ? `Missing: ${missingItems[0]}`
              : `${missingItems.length} items incomplete`,
            urgency: daysUntilBlitz && daysUntilBlitz <= 7 ? 'high' : missingItems.length >= 3 ? 'high' : 'medium',
            daysUntilBlitz,
            missingItems,
            onboardingStatus: rampPhase,
            trainingProgress: {
              onboardingComplete,
              trainingsComplete,
              slackJoined,
              ipadAssigned,
              rampPhase,
            },
          });
        }
      });
    }

    if (trainingRecruits.length > 0) {
      categories.push({
        id: 'training-progress',
        label: 'Training',
        emoji: '📚',
        count: trainingRecruits.length,
        recruits: trainingRecruits.sort((a, b) => {
          // Sort by urgency then by missing items count
          if (a.urgency !== b.urgency) {
            return a.urgency === 'high' ? -1 : b.urgency === 'high' ? 1 : 0;
          }
          return (b.missingItems?.length || 0) - (a.missingItems?.length || 0);
        }),
        priority: 95,
      });
    }

    // 2. Blitz Prep - recruits with upcoming blitz but missing readiness
    const blitzPrepRecruits: AttentionRecruit[] = [];
    
    if (upcomingBlitzes.length > 0) {
      const signedRecruits = recruits.filter(r => 
        r.stage === 'Signed' || r.stage === 'Shadow ✅'
      );

      signedRecruits.forEach(recruit => {
        const isRookie = recruit.year === 'Rookie' || recruit.year === '2025';
        
        if (isRookie) {
          const nearestBlitz = upcomingBlitzes[0];
          const daysUntilBlitz = differenceInDays(parseISO(nearestBlitz.date), now);
          
          // Check if they have training issues - don't duplicate if already in training category
          const hasTrainingIssues = trainingRecruits.some(t => t.recruit.notionPageId === recruit.notionPageId);
          
          if (!hasTrainingIssues) {
            blitzPrepRecruits.push({
              recruit,
              reason: `${nearestBlitz.name} in ${daysUntilBlitz} days`,
              urgency: daysUntilBlitz <= 7 ? 'high' : daysUntilBlitz <= 14 ? 'medium' : 'low',
              daysUntilBlitz,
            });
          }
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

    // 3. Stale Contacts - haven't been contacted in 7+ days (stage-dependent)
    const staleRecruits: AttentionRecruit[] = [];
    
    recruits.forEach(recruit => {
      if (recruit.stage === 'Not Interested' || recruit.stage === 'Signed but Not Interested') {
        return;
      }

      const lastContact = lastContactMap.get(recruit.notionPageId);
      const daysSince = lastContact ? differenceInDays(now, lastContact) : null;

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
          if (a.daysSinceContact === undefined) return -1;
          if (b.daysSinceContact === undefined) return 1;
          return b.daysSinceContact - a.daysSinceContact;
        }),
        priority: 80,
      });
    }

    // 4. No Commitment - Signed reps without blitz commitment
    const noCommitmentRecruits: AttentionRecruit[] = [];
    
    const signedWithoutCommitment = recruits.filter(r => 
      (r.stage === 'Signed' || r.stage === 'Shadow ✅') &&
      (r.year === 'Rookie' || r.year === '2025')
    );

    signedWithoutCommitment.forEach(recruit => {
      const repData = repDataMap?.get(recruit.notionPageId);
      const committedBlitzes = repData?.committed_blitzes as string[] | null;
      
      if (!committedBlitzes || committedBlitzes.length === 0) {
        noCommitmentRecruits.push({
          recruit,
          reason: 'No blitz commitment',
          urgency: 'medium',
        });
      }
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

    // 5. Hot Leads - Evaluating stage recruits
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
        break;
      }
    }

    const totalCount = categories.reduce((sum, cat) => sum + cat.count, 0);

    return {
      categories,
      topPriority,
      totalCount,
    };
  }, [recruits, activities, blitzes, repDataMap]);
};
