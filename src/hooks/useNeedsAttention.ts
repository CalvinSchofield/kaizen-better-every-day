import { useMemo } from "react";
import { Recruit, RecruitActivity } from "./useGroupRecruits";
import { differenceInDays, parseISO } from "date-fns";
import { getCommitmentPaceStatus, PaceStatus } from "@/utils/paceCalculator";

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
  // Readiness-specific fields
  readinessProgress?: {
    trainingHoursGoal: number;
    trainingHoursProgress: number;
    booksGoal: number;
    booksProgress: number;
    rolePlaysGoal: number;
    rolePlaysProgress: number;
    mnlGoal: number;
    mnlProgress: number;
    behindCount: number;
  };
  blitzCommitments?: {
    committedCount: number;
    upcomingBlitzNames: string[];
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
  user_id?: string;
}

export interface RepGoalsData {
  user_id: string;
  training_hours_goal: number | null;
  training_hours_progress: number | null;
  books_goal: number | null;
  books_progress: number | null;
  role_plays_goal: number | null;
  role_plays_progress: number | null;
  monday_night_lights_goal: number | null;
  monday_night_lights_progress: number | null;
  blitzes_goal: number | null;
  blitzes_progress: number | null;
}

export interface RepSummerConfigData {
  user_id: string;
  personal_summer_start: string | null;
}

export const useNeedsAttention = (
  recruits: Recruit[],
  activities: RecruitActivity[],
  blitzes: BlitzEvent[],
  repDataMap?: Map<string, RepData>,
  repGoalsMap?: Map<string, RepGoalsData>,
  repSummerConfigMap?: Map<string, RepSummerConfigData>
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

    // Find upcoming blitzes within 30 days
    const upcomingBlitzes = blitzes.filter(b => {
      const blitzDate = parseISO(b.date);
      const daysUntil = differenceInDays(blitzDate, now);
      return daysUntil >= 0 && daysUntil <= 30;
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

      // Now populate onboarding (exclude those going to Blitz Prep, only Rookies)
      const signedRecruits = recruits.filter(r => 
        (r.stage === 'Signed' || r.stage === 'Shadow ✅') && r.year === 'Rookie'
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
          const firstName = recruit.name?.split(' ')[0] || 'Recruit';
          const missingText = missingItems.length === 1 
            ? missingItems[0]
            : missingItems.slice(0, 2).join(' & ') + (missingItems.length > 2 ? ` +${missingItems.length - 2}` : '');
          
          onboardingRecruits.push({
            recruit,
            reason: `${firstName} needs ${missingText} before they can start ramp to blitz`,
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

        // Find the nearest committed blitz within 30 days
        let nearestCommittedBlitz: { blitz: typeof upcomingBlitzes[0]; daysUntil: number } | null = null;
        
        for (const blitz of upcomingBlitzes) {
          if (committedBlitzIds.includes(blitz.id)) {
            const daysUntil = differenceInDays(parseISO(blitz.date), now);
            if (daysUntil >= 0 && daysUntil <= 30) {
              if (!nearestCommittedBlitz || daysUntil < nearestCommittedBlitz.daysUntil) {
                nearestCommittedBlitz = { blitz, daysUntil };
              }
            }
          }
        }

        // Only add if committed to upcoming blitz within 30 days
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

        // Build reason based on what's incomplete - more descriptive
        const firstName = recruit.name?.split(' ')[0] || 'Rookie';
        let reason = '';
        if (incompletePhases.length > 0) {
          reason = `${firstName} has ${incompletePhases.length} phase${incompletePhases.length > 1 ? 's' : ''} left and blitz is in ${daysUntilBlitz} day${daysUntilBlitz !== 1 ? 's' : ''}!`;
        } else if (missingItems.length > 0) {
          reason = `${firstName} needs ${missingItems.length} item${missingItems.length > 1 ? 's' : ''} before ${nearestCommittedBlitz.blitz.name}`;
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
      // Exclude stages that don't need active contact tracking
      if (recruit.stage === 'Not Interested' || 
          recruit.stage === 'Signed but Not Interested' ||
          recruit.stage === 'Potential Follow Up') {
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
        const firstName = recruit.name?.split(' ')[0] || 'Recruit';
        let reason: string;
        if (daysSince === null) {
          reason = `Reach out to ${firstName}—they've never been contacted`;
        } else {
          reason = `It's been ${daysSince} days since you contacted ${firstName}`;
        }
        
        staleRecruits.push({
          recruit,
          reason,
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

    // 4. No Blitz History - Signed/Shadow/Sold reps with NO blitzes at all (never attended any)
    const noBlitzRecruits: AttentionRecruit[] = [];
    
    // Include all signed, shadow, and sold stages
    const blitzEligibleRecruits = recruits.filter(r => 
      r.stage === 'Signed' || 
      r.stage === 'Shadow ✅' || 
      r.stage === 'Sold 💲' || 
      r.stage === 'Sold (5+) 💰'
    );

    // Build a set of past blitz IDs (blitzes that have already ended)
    const pastBlitzIds = new Set(
      blitzes
        .filter(b => {
          const endDate = b.endDate ? parseISO(b.endDate) : parseISO(b.date);
          return endDate < now;
        })
        .map(b => b.id)
    );

    blitzEligibleRecruits.forEach(recruit => {
      const repData = repDataMap?.get(recruit.notionPageId);
      const rawCommitments = repData?.committed_blitzes || [];
      const committedBlitzIds: string[] = Array.isArray(rawCommitments)
        ? rawCommitments.map((b: string | { id: string }) => typeof b === 'string' ? b : b.id)
        : [];
      
      // Check if they have attended ANY past blitz
      const hasAttendedPastBlitz = committedBlitzIds.some(id => pastBlitzIds.has(id));
      
      // Only show if they have NEVER attended any blitz
      if (hasAttendedPastBlitz) return;
      
      // Also skip if they have no blitz commitments at all OR only have future blitzes
      const hasAnyCommitment = committedBlitzIds.length > 0;
      
      if (!hasAnyCommitment) {
        const firstName = recruit.name?.split(' ')[0] || 'Recruit';
        noBlitzRecruits.push({
          recruit,
          reason: `${firstName} hasn't committed to any blitz yet—help them pick one!`,
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
          // First sort by year: Rookies first, then Sophomores, then Vets
          const yearOrder: Record<string, number> = { 'Rookie': 0, 'Sophomore': 1, 'Vet': 2 };
          const yearA = yearOrder[a.recruit.year || ''] ?? 99;
          const yearB = yearOrder[b.recruit.year || ''] ?? 99;
          if (yearA !== yearB) return yearA - yearB;
          
          // Then by stage: Signed/Shadow over Sold stages
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

      const firstName = recruit.name?.split(' ')[0] || 'Recruit';
      let reason: string;
      if (daysSince === null) {
        reason = `${firstName} is evaluating—reach out and close them!`;
      } else if (daysSince >= 3) {
        reason = `${firstName} is hot—it's been ${daysSince} days, follow up now!`;
      } else {
        reason = `${firstName} is evaluating—keep the momentum going`;
      }
      
      hotLeadRecruits.push({
        recruit,
        reason,
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

    // 6. Readiness - Rookies with their preseason progress and blitz commitments
    const readinessRecruits: AttentionRecruit[] = [];
    
    // Only rookies
    const rookiesForReadiness = recruits.filter(r => r.year === 'Rookie');
    
    rookiesForReadiness.forEach(recruit => {
      const repData = repDataMap?.get(recruit.notionPageId);
      if (!repData?.user_id) return;
      
      const goalsData = repGoalsMap?.get(repData.user_id);
      const summerConfig = repSummerConfigMap?.get(repData.user_id);
      const personalSummerStart = summerConfig?.personal_summer_start || null;
      
      // Get blitz commitments
      const rawCommitments = repData.committed_blitzes || [];
      const committedBlitzIds: string[] = Array.isArray(rawCommitments)
        ? rawCommitments.map((b: string | { id: string }) => typeof b === 'string' ? b : b.id)
        : [];
      
      // Find future committed blitzes
      const futureCommittedBlitzes = blitzes.filter(b => {
        const blitzDate = parseISO(b.date);
        return blitzDate >= now && committedBlitzIds.includes(b.id);
      });
      
      // Get goal values
      const trainingGoal = (goalsData?.training_hours_goal || 0) * 60; // Convert hours to minutes
      const trainingProgress = goalsData?.training_hours_progress || 0;
      const booksGoal = goalsData?.books_goal || 0;
      const booksProgress = goalsData?.books_progress || 0;
      const rolePlaysGoal = goalsData?.role_plays_goal || 0;
      const rolePlaysProgress = goalsData?.role_plays_progress || 0;
      const mnlGoal = goalsData?.monday_night_lights_goal || 0;
      const mnlProgress = goalsData?.monday_night_lights_progress || 0;
      
      // Use pace calculator to determine if behind
      let behindCount = 0;
      const behindAreas: string[] = [];
      
      // Training hours use weekly pace (resets Sunday)
      const trainingPaceStatus = getCommitmentPaceStatus('training', trainingProgress, trainingGoal, personalSummerStart);
      if (trainingGoal > 0 && trainingPaceStatus === 'behind') {
        behindCount++;
        behindAreas.push('Training');
      }
      
      // Books use preseason pace (until summer start)
      const booksPaceStatus = getCommitmentPaceStatus('books', booksProgress, booksGoal, personalSummerStart);
      if (booksGoal > 0 && booksPaceStatus === 'behind') {
        behindCount++;
        behindAreas.push('Books');
      }
      
      // Role plays use preseason pace
      const rolePLaysPaceStatus = getCommitmentPaceStatus('role_plays', rolePlaysProgress, rolePlaysGoal, personalSummerStart);
      if (rolePlaysGoal > 0 && rolePLaysPaceStatus === 'behind') {
        behindCount++;
        behindAreas.push('Role Plays');
      }
      
      // MNL uses preseason pace
      const mnlPaceStatus = getCommitmentPaceStatus('monday_night_lights', mnlProgress, mnlGoal, personalSummerStart);
      if (mnlGoal > 0 && mnlPaceStatus === 'behind') {
        behindCount++;
        behindAreas.push('MNL');
      }
      
      const firstName = recruit.name?.split(' ')[0] || 'Rookie';
      let reason = '';
      let urgency: 'high' | 'medium' | 'low' = 'low';
      
      // Determine reason - blitz commitments don't affect "on track" status, only goals do
      if (committedBlitzIds.length === 0) {
        reason = `${firstName} hasn't committed to any blitz yet`;
        urgency = 'high';
      } else if (behindCount > 0) {
        reason = `${firstName} is behind on ${behindAreas.slice(0, 2).join(' & ')}${behindAreas.length > 2 ? ` +${behindAreas.length - 2}` : ''}`;
        urgency = behindCount >= 3 ? 'high' : behindCount >= 2 ? 'medium' : 'low';
      } else {
        // On track - not behind on any goals (preseason trips not considered for on-track status)
        reason = `${firstName} is on track`;
        urgency = 'low';
      }
      
      readinessRecruits.push({
        recruit,
        reason,
        urgency,
        readinessProgress: {
          trainingHoursGoal: trainingGoal,
          trainingHoursProgress: trainingProgress,
          booksGoal,
          booksProgress,
          rolePlaysGoal,
          rolePlaysProgress,
          mnlGoal,
          mnlProgress,
          behindCount,
        },
        blitzCommitments: {
          committedCount: committedBlitzIds.length,
          upcomingBlitzNames: futureCommittedBlitzes.map(b => b.name),
        },
      });
    });

    if (readinessRecruits.length > 0) {
      categories.push({
        id: 'readiness',
        label: 'Readiness',
        emoji: '📊',
        count: readinessRecruits.length,
        recruits: readinessRecruits.sort((a, b) => {
          // Sort: no blitz first, then by behind count (most behind first)
          const aNoBlitz = (a.blitzCommitments?.committedCount || 0) === 0;
          const bNoBlitz = (b.blitzCommitments?.committedCount || 0) === 0;
          if (aNoBlitz && !bNoBlitz) return -1;
          if (!aNoBlitz && bNoBlitz) return 1;
          return (b.readinessProgress?.behindCount || 0) - (a.readinessProgress?.behindCount || 0);
        }),
        priority: 70, // Lower priority than other action-oriented categories
      });
    }

    // Sort categories by priority
    categories.sort((a, b) => b.priority - a.priority);

    // Get top priority recruit across ALL categories (not just the first)
    let topPriority: AttentionRecruit | null = null;
    let topPriorityScore = -1;

    const urgencyScore: Record<string, number> = { 'high': 3, 'medium': 2, 'low': 1 };

    for (const category of categories) {
      if (category.recruits.length > 0) {
        const topInCategory = category.recruits[0]; // Already sorted within category by urgency
        
        // Calculate combined score: urgency weight (×100) + category priority
        const score = (urgencyScore[topInCategory.urgency] * 100) + category.priority;
        
        if (score > topPriorityScore) {
          topPriorityScore = score;
          topPriority = topInCategory;
        }
      }
    }

    const totalCount = categories.reduce((sum, cat) => sum + cat.count, 0);

    return {
      categories,
      topPriority,
      totalCount,
    };
  }, [recruits, activities, blitzes, repDataMap, repGoalsMap, repSummerConfigMap]);
};
