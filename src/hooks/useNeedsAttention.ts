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
  blitzName?: string;
  trainingProgress?: {
    onboardingComplete: boolean;
    trainingsComplete: boolean;
    slackJoined: boolean;
    ipadAssigned: boolean;
    rampPhase: string;
  };
  rampPhaseProgress?: {
    phase1Complete: boolean;
    phase2Complete: boolean;
    phase3Complete: boolean;
    phase4Complete: boolean;
    incompletePhases: string[];
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
  ramp_phase_1_complete: boolean | null;
  ramp_phase_2_complete: boolean | null;
  ramp_phase_3_complete: boolean | null;
  ramp_phase_4_complete: boolean | null;
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

    // 1. Onboarding - Signed recruits with incomplete foundational onboarding items
    // BUT only if they DON'T have an upcoming blitz (those go to Blitz Prep instead)
    const onboardingRecruits: AttentionRecruit[] = [];
    
    // Track which recruits go to Blitz Prep so we can exclude them from Onboarding
    const blitzPrepNotionIds = new Set<string>();
    
    if (repDataMap) {
      // First pass: identify who has committed blitzes within 21 days (for Blitz Prep)
      const rookieRecruits = recruits.filter(r => 
        (r.stage === 'Signed' || r.stage === 'Shadow ✅') && r.year === 'Rookie'
      );

      rookieRecruits.forEach(recruit => {
        const repData = repDataMap.get(recruit.notionPageId);
        if (!repData) return;

        const rawCommitments = repData.committed_blitzes || [];
        const committedBlitzIds: string[] = Array.isArray(rawCommitments)
          ? rawCommitments.map((b: string | { id: string }) => typeof b === 'string' ? b : b.id)
          : [];

        // Check if committed to a blitz within 21 days
        const hasUpcomingCommittedBlitz = upcomingBlitzes.some(blitz => 
          committedBlitzIds.includes(blitz.id)
        );

        if (hasUpcomingCommittedBlitz) {
          blitzPrepNotionIds.add(recruit.notionPageId);
        }
      });

      // Now populate onboarding (exclude those going to Blitz Prep)
      const signedRecruits = recruits.filter(r => 
        r.stage === 'Signed' || r.stage === 'Shadow ✅'
      );

      signedRecruits.forEach(recruit => {
        // Skip if this recruit is going to Blitz Prep
        if (blitzPrepNotionIds.has(recruit.notionPageId)) return;

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

        // Only add if something is missing (these are foundational items)
        if (missingItems.length > 0) {
          onboardingRecruits.push({
            recruit,
            reason: missingItems.length === 1 
              ? `Missing: ${missingItems[0]}`
              : `${missingItems.length} items incomplete`,
            urgency: missingItems.length >= 3 ? 'high' : 'medium',
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

    if (onboardingRecruits.length > 0) {
      categories.push({
        id: 'training-progress',
        label: 'Onboarding',
        emoji: '📋',
        count: onboardingRecruits.length,
        recruits: onboardingRecruits.sort((a, b) => {
          // Sort by urgency then by missing items count
          if (a.urgency !== b.urgency) {
            return a.urgency === 'high' ? -1 : b.urgency === 'high' ? 1 : 0;
          }
          return (b.missingItems?.length || 0) - (a.missingItems?.length || 0);
        }),
        priority: 95,
      });
    }

    // 2. Blitz Prep - Rookies committed to blitz within 21 days who have incomplete ramp phases
    // This is highest priority - they're actively preparing for an imminent blitz
    const blitzPrepRecruits: AttentionRecruit[] = [];
    
    if (repDataMap) {
      // Only rookies in active stages
      const rookieRecruits = recruits.filter(r => 
        (r.stage === 'Signed' || r.stage === 'Shadow ✅') && r.year === 'Rookie'
      );

      rookieRecruits.forEach(recruit => {
        const repData = repDataMap.get(recruit.notionPageId);
        if (!repData) return;

        // Get onboarding status
        const onboardingComplete = repData.onboarding_complete ?? false;
        const trainingsComplete = repData.trainings_complete ?? false;
        const slackJoined = repData.slack_joined ?? false;
        const ipadAssigned = repData.ipad_assigned ?? false;
        const rampPhase = repData.ramp_to_blitz_phase || 'Not started';

        // REQUIREMENT: Must have completed foundational onboarding (Slack ✅ = steps 1-3 done)
        // This means: onboarding complete, trainings complete, and slack joined
        if (!slackJoined) return;

        // Check ramp phases
        const phase1Complete = repData.ramp_phase_1_complete ?? false;
        const phase2Complete = repData.ramp_phase_2_complete ?? false;
        const phase3Complete = repData.ramp_phase_3_complete ?? false;
        const phase4Complete = repData.ramp_phase_4_complete ?? false;

        // If all phases complete, they're ready - no blitz prep needed
        if (phase1Complete && phase2Complete && phase3Complete && phase4Complete) return;

        // Check if committed to a blitz within 21 days
        const rawCommitments = repData.committed_blitzes || [];
        const committedBlitzIds: string[] = Array.isArray(rawCommitments)
          ? rawCommitments.map((b: string | { id: string }) => typeof b === 'string' ? b : b.id)
          : [];

        // Find the nearest committed blitz within 21 days
        let nearestCommittedBlitz: { blitz: typeof upcomingBlitzes[0]; daysUntil: number } | null = null;
        
        for (const blitz of upcomingBlitzes) {
          if (committedBlitzIds.includes(blitz.id)) {
            const daysUntil = differenceInDays(parseISO(blitz.date), now);
            if (daysUntil >= 0 && daysUntil <= 21) {
              if (!nearestCommittedBlitz || daysUntil < nearestCommittedBlitz.daysUntil) {
                nearestCommittedBlitz = { blitz, daysUntil };
              }
            }
          }
        }

        // Only add if committed to upcoming blitz within 21 days
        if (!nearestCommittedBlitz) return;

        // Get incomplete phases list (for display)
        const incompletePhases: string[] = [];
        if (!phase1Complete) incompletePhases.push('Phase 1');
        if (!phase2Complete) incompletePhases.push('Phase 2');
        if (!phase3Complete) incompletePhases.push('Phase 3');
        if (!phase4Complete) incompletePhases.push('Phase 4');

        // Get missing onboarding items
        const missingItems: string[] = [];
        if (!onboardingComplete) missingItems.push('Onboarding');
        if (!trainingsComplete) missingItems.push('Trainings');
        if (!slackJoined) missingItems.push('Slack');
        if (!ipadAssigned) missingItems.push('iPad');

        const daysUntilBlitz = nearestCommittedBlitz.daysUntil;
        
        // Urgency based on days until blitz
        let urgency: 'high' | 'medium' | 'low';
        if (daysUntilBlitz <= 7) {
          urgency = 'high'; // CRITICAL
        } else if (daysUntilBlitz <= 14) {
          urgency = 'medium'; // HIGH
        } else {
          urgency = 'low'; // MEDIUM (15-21 days)
        }

        // Build reason based on what's incomplete
        let reason = '';
        if (incompletePhases.length > 0) {
          reason = `${incompletePhases.length} phase${incompletePhases.length > 1 ? 's' : ''} to go`;
        } else if (missingItems.length > 0) {
          reason = `${missingItems.length} item${missingItems.length > 1 ? 's' : ''} to complete`;
        }

        blitzPrepRecruits.push({
          recruit,
          reason,
          urgency,
          daysUntilBlitz,
          blitzName: nearestCommittedBlitz.blitz.name,
          missingItems: missingItems.length > 0 ? missingItems : undefined,
          trainingProgress: {
            onboardingComplete,
            trainingsComplete,
            slackJoined,
            ipadAssigned,
            rampPhase,
          },
          rampPhaseProgress: {
            phase1Complete,
            phase2Complete,
            phase3Complete,
            phase4Complete,
            incompletePhases,
          },
        });
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

    // 4. No Blitz History - Signed/Shadow/Sold reps with NO blitzes (past or future)
    const noBlitzRecruits: AttentionRecruit[] = [];
    
    // Include all signed, shadow, and sold stages
    const blitzEligibleRecruits = recruits.filter(r => 
      r.stage === 'Signed' || 
      r.stage === 'Shadow ✅' || 
      r.stage === 'Sold 💲' || 
      r.stage === 'Sold (5+) 💰'
    );

    // Get all blitz IDs (past and future)
    const allBlitzIds = new Set(blitzes.map(b => b.id));

    blitzEligibleRecruits.forEach(recruit => {
      const repData = repDataMap?.get(recruit.notionPageId);
      const committedBlitzes = repData?.committed_blitzes as string[] | null;
      
      // Check if they have ANY blitz commitment (past or future)
      const hasAnyBlitzCommitment = committedBlitzes && committedBlitzes.length > 0;
      
      // Only add if they have ZERO blitz history
      if (!hasAnyBlitzCommitment) {
        noBlitzRecruits.push({
          recruit,
          reason: 'No blitz history',
          urgency: recruit.stage === 'Signed' || recruit.stage === 'Shadow ✅' ? 'high' : 'medium',
        });
      }
    });

    if (noBlitzRecruits.length > 0) {
      categories.push({
        id: 'no-commitment',
        label: 'No Blitz',
        emoji: '⚠️',
        count: noBlitzRecruits.length,
        recruits: noBlitzRecruits.sort((a, b) => {
          // Prioritize Signed/Shadow over Sold stages
          const stageOrder = { 'Signed': 0, 'Shadow ✅': 1, 'Sold 💲': 2, 'Sold (5+) 💰': 3 };
          return (stageOrder[a.recruit.stage as keyof typeof stageOrder] || 99) - 
                 (stageOrder[b.recruit.stage as keyof typeof stageOrder] || 99);
        }),
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
