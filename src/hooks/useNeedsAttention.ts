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
  showDivider?: boolean; // For "No Blitz" category to separate never-attended from no-future
  pastBlitzCount?: number; // Number of past blitzes attended (for "already attended" display)
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
    missingGoals: string[];
    fpGoal: number;
    fpCurrent: number;
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

    // 1. Onboarding - Rookies still completing foundational onboarding items
    // Onboarding stages: Not started -> Onboarding video -> Trainings -> Slack ✅
    // This shows anyone who hasn't completed ALL foundational items (onboarding, trainings, slack)
    const onboardingRecruits: AttentionRecruit[] = [];
    
    if (repDataMap) {
      // Only rookies in active stages (Signed or Shadow)
      const rookieRecruits = recruits.filter(r => 
        (r.stage === 'Signed' || r.stage === 'Shadow ✅') && r.year === 'Rookie'
      );

      rookieRecruits.forEach(recruit => {
        const repData = repDataMap.get(recruit.notionPageId);
        if (!repData) return;

        const onboardingComplete = repData.onboarding_complete ?? false;
        const trainingsComplete = repData.trainings_complete ?? false;
        const slackJoined = repData.slack_joined ?? false;
        const ipadAssigned = repData.ipad_assigned ?? false;
        const rampPhase = repData.ramp_to_blitz_phase || 'Not started';

        // Onboarding is complete when: onboarding video done AND trainings done AND slack joined
        // (iPad is tracked separately as it's more of a logistics item)
        const foundationalComplete = onboardingComplete && trainingsComplete && slackJoined;
        
        // If they've completed all foundational onboarding, they go to Blitz Prep instead
        if (foundationalComplete) return;

        const missingItems: string[] = [];
        if (!onboardingComplete) missingItems.push('Onboarding');
        if (!trainingsComplete) missingItems.push('Trainings');
        if (!slackJoined) missingItems.push('Slack');

        // Only add if something is missing
        if (missingItems.length > 0) {
          const firstName = recruit.name?.split(' ')[0] || 'Recruit';
          const missingText = missingItems.length === 1 
            ? missingItems[0]
            : missingItems.slice(0, 2).join(' & ') + (missingItems.length > 2 ? ` +${missingItems.length - 2}` : '');
          
          // Check for upcoming blitz to add urgency context
          const rawCommitments = repData.committed_blitzes || [];
          const committedBlitzIds: string[] = Array.isArray(rawCommitments)
            ? rawCommitments.map((b: string | { id: string }) => typeof b === 'string' ? b : b.id)
            : [];
          
          let nearestBlitzDays: number | undefined;
          let nearestBlitzName: string | undefined;
          for (const blitz of upcomingBlitzes) {
            if (committedBlitzIds.includes(blitz.id)) {
              const days = differenceInDays(parseISO(blitz.date), now);
              if (nearestBlitzDays === undefined || days < nearestBlitzDays) {
                nearestBlitzDays = days;
                nearestBlitzName = blitz.name;
              }
            }
          }
          
          // Get days since last contact
          const lastContact = lastContactMap.get(recruit.notionPageId);
          const daysSinceContact = lastContact ? differenceInDays(now, lastContact) : undefined;
          
          // Higher urgency if they have a blitz coming up
          const hasUpcomingBlitz = nearestBlitzDays !== undefined && nearestBlitzDays <= 21;
          const urgencyLevel = hasUpcomingBlitz 
            ? 'high' 
            : missingItems.length >= 3 ? 'high' : 'medium';
          
          const reason = hasUpcomingBlitz
            ? `${firstName} has blitz in ${nearestBlitzDays}d but needs ${missingText}`
            : `${firstName} needs ${missingText} before they can start ramp to blitz`;
          
          onboardingRecruits.push({
            recruit,
            reason,
            urgency: urgencyLevel,
            missingItems: [...missingItems, ...(ipadAssigned ? [] : ['iPad'])],
            onboardingStatus: rampPhase,
            daysUntilBlitz: nearestBlitzDays,
            daysSinceContact,
            blitzName: nearestBlitzName,
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
          // Sort by blitz proximity first (if they have one)
          if (a.daysUntilBlitz !== undefined && b.daysUntilBlitz === undefined) return -1;
          if (a.daysUntilBlitz === undefined && b.daysUntilBlitz !== undefined) return 1;
          if (a.daysUntilBlitz !== undefined && b.daysUntilBlitz !== undefined) {
            if (a.daysUntilBlitz !== b.daysUntilBlitz) {
              return a.daysUntilBlitz - b.daysUntilBlitz;
            }
          }
          // Then by days since last contact (furthest away first)
          const aDays = a.daysSinceContact ?? 999;
          const bDays = b.daysSinceContact ?? 999;
          return bDays - aDays;
        }),
        priority: 95,
      });
    }

    // 2. Blitz Prep - All rookies who have completed foundational onboarding but haven't finished ramp to blitz phases
    // They must have completed foundational onboarding (onboarding + trainings + slack = all done)
    // This shows everyone who is IN the ramp to blitz process but not yet done with all 4 phases
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

        // REQUIREMENT: Must have completed ALL foundational onboarding (onboarding + trainings + slack)
        // If not, they'll be in the Onboarding tab instead
        const foundationalComplete = onboardingComplete && trainingsComplete && slackJoined;
        if (!foundationalComplete) return;

        // Check ramp phases
        const phase1Complete = repData.ramp_phase_1_complete ?? false;
        const phase2Complete = repData.ramp_phase_2_complete ?? false;
        const phase3Complete = repData.ramp_phase_3_complete ?? false;
        const phase4Complete = repData.ramp_phase_4_complete ?? false;

        // If all phases complete, they're ready - no blitz prep needed
        if (phase1Complete && phase2Complete && phase3Complete && phase4Complete) return;

        // Check if committed to any upcoming blitz (for context)
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

        // Get incomplete phases list
        const incompletePhases: string[] = [];
        if (!phase1Complete) incompletePhases.push('Phase 1');
        if (!phase2Complete) incompletePhases.push('Phase 2');
        if (!phase3Complete) incompletePhases.push('Phase 3');
        if (!phase4Complete) incompletePhases.push('Phase 4');

        // Get missing items for context (iPad is important for blitz)
        const missingItems: string[] = [];
        if (!ipadAssigned) missingItems.push('iPad');

        const daysUntilBlitz = nearestCommittedBlitz?.daysUntil;
        
        // Urgency: highest if they have committed blitz coming up
        let urgency: 'high' | 'medium' | 'low';
        if (daysUntilBlitz !== undefined && daysUntilBlitz <= 7) {
          urgency = 'high'; // CRITICAL - blitz in a week
        } else if (daysUntilBlitz !== undefined && daysUntilBlitz <= 14) {
          urgency = 'high'; // HIGH - blitz in 2 weeks
        } else if (daysUntilBlitz !== undefined && daysUntilBlitz <= 21) {
          urgency = 'medium'; // MEDIUM - blitz in 3 weeks
        } else if (incompletePhases.length >= 3) {
          urgency = 'medium'; // Many phases left
        } else {
          urgency = 'low';
        }

        const firstName = recruit.name?.split(' ')[0] || 'Rookie';
        let reason = '';
        if (nearestCommittedBlitz && incompletePhases.length > 0) {
          reason = `${firstName} has ${incompletePhases.length} phase${incompletePhases.length > 1 ? 's' : ''} left and blitz is in ${daysUntilBlitz} day${daysUntilBlitz !== 1 ? 's' : ''}!`;
        } else if (incompletePhases.length > 0) {
          reason = `${firstName} has ${incompletePhases.length} ramp phase${incompletePhases.length > 1 ? 's' : ''} to complete`;
        }

        blitzPrepRecruits.push({
          recruit,
          reason,
          urgency,
          daysUntilBlitz,
          blitzName: nearestCommittedBlitz?.blitz.name,
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
        // Sort: those with committed blitzes first (by days until), then by phases remaining
        recruits: blitzPrepRecruits.sort((a, b) => {
          // Committed blitz takes priority
          if (a.daysUntilBlitz !== undefined && b.daysUntilBlitz === undefined) return -1;
          if (a.daysUntilBlitz === undefined && b.daysUntilBlitz !== undefined) return 1;
          if (a.daysUntilBlitz !== undefined && b.daysUntilBlitz !== undefined) {
            return a.daysUntilBlitz - b.daysUntilBlitz;
          }
          // Both have no committed blitz - sort by phases remaining (more phases = higher priority)
          const aPhases = a.rampPhaseProgress?.incompletePhases?.length || 0;
          const bPhases = b.rampPhaseProgress?.incompletePhases?.length || 0;
          return bPhases - aPhases;
        }),
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
    // Also track those who attended blitzes but have no future ones planned
    const noBlitzRecruits: AttentionRecruit[] = [];
    const noFutureBlitzRecruits: AttentionRecruit[] = [];
    
    // Include all signed, shadow, and sold stages
    const blitzEligibleRecruits = recruits.filter(r => 
      r.stage === 'Signed' || 
      r.stage === 'Shadow ✅' || 
      r.stage === 'Sold 💲' || 
      r.stage === 'Sold (5+) 💰'
    );

    // Build sets for past, current, and future blitzes
    const pastBlitzIds = new Set(
      blitzes
        .filter(b => {
          const endDate = b.endDate ? parseISO(b.endDate) : parseISO(b.date);
          // End date is before today (has already finished)
          return endDate < now;
        })
        .map(b => b.id)
    );

    const currentBlitzIds = new Set(
      blitzes
        .filter(b => {
          const startDate = parseISO(b.date);
          const endDate = b.endDate ? parseISO(b.endDate) : parseISO(b.date);
          // Started on or before today AND ends on or after today
          return startDate <= now && endDate >= now;
        })
        .map(b => b.id)
    );

    const futureBlitzIds = new Set(
      blitzes
        .filter(b => {
          const startDate = parseISO(b.date);
          return startDate > now;
        })
        .map(b => b.id)
    );

    blitzEligibleRecruits.forEach(recruit => {
      const repData = repDataMap?.get(recruit.notionPageId);
      
      // Get committed blitz IDs from BOTH sources:
      // 1. repData.committed_blitzes (Supabase reps table - has full blitz objects for registered users)
      // 2. recruit.committedBlitzes (from fetch-team-members Notion query - just relation IDs for non-registered recruits)
      const rawCommitmentsFromSupabase = repData?.committed_blitzes || [];
      const rawCommitmentsFromNotion = (recruit as any).committedBlitzes || [];
      
      // Extract IDs from Supabase data (can be strings or objects with id property)
      const supabaseBlitzIds: string[] = Array.isArray(rawCommitmentsFromSupabase)
        ? rawCommitmentsFromSupabase.map((b: string | { id: string }) => typeof b === 'string' ? b : b.id)
        : [];
      
      // Notion data from fetch-team-members is just an array of IDs (strings)
      const notionBlitzIds: string[] = Array.isArray(rawCommitmentsFromNotion)
        ? rawCommitmentsFromNotion.filter((id: any) => typeof id === 'string')
        : [];
      
      // Merge both sources, remove duplicates
      const committedBlitzIds = [...new Set([...supabaseBlitzIds, ...notionBlitzIds])];
      
      // Check if they have ANY committed blitzes at all (past, current, or future)
      const hasAnyBlitzCommitment = committedBlitzIds.length > 0;
      
      // Check if any of their commitments are past blitzes (blitzes that have already ended)
      const hasPastBlitz = committedBlitzIds.some(id => pastBlitzIds.has(id));
      
      // Check if they are on a CURRENT blitz (happening now)
      const isOnCurrentBlitz = committedBlitzIds.some(id => currentBlitzIds.has(id));
      
      // Check if they have ANY future blitz committed
      const hasFutureBlitzCommitment = committedBlitzIds.some(id => futureBlitzIds.has(id));
      
      const firstName = recruit.name?.split(' ')[0] || 'Recruit';
      
      // If they're on a current blitz or have a future blitz, skip them entirely
      if (isOnCurrentBlitz || hasFutureBlitzCommitment) return;
      
      if (!hasAnyBlitzCommitment) {
        // NEVER committed to any blitz ever - highest priority
        noBlitzRecruits.push({
          recruit,
          reason: `${firstName} hasn't been on any blitz yet—help them pick one!`,
          urgency: recruit.stage === 'Signed' || recruit.stage === 'Shadow ✅' ? 'high' : 'medium',
        });
      } else if (hasPastBlitz && !hasFutureBlitzCommitment) {
        // Has been on past blitzes but no future ones planned - secondary priority
        // Count how many past blitzes they attended
        const pastBlitzCount = committedBlitzIds.filter(id => pastBlitzIds.has(id)).length;
        noFutureBlitzRecruits.push({
          recruit,
          reason: `${firstName} has no more blitzes planned for the season`,
          urgency: 'low',
          pastBlitzCount,
        });
      }
    });

    // Combine: never-attended first, then no-future-planned with a visual separator indicator
    const combinedNoBlitz = [
      ...noBlitzRecruits.sort((a, b) => {
        const yearOrder: Record<string, number> = { 'Rookie': 0, 'Sophomore': 1, 'Vet': 2 };
        const yearA = yearOrder[a.recruit.year || ''] ?? 99;
        const yearB = yearOrder[b.recruit.year || ''] ?? 99;
        if (yearA !== yearB) return yearA - yearB;
        const stageOrder = { 'Signed': 0, 'Shadow ✅': 1, 'Sold 💲': 2, 'Sold (5+) 💰': 3 };
        return (stageOrder[a.recruit.stage as keyof typeof stageOrder] || 99) - (stageOrder[b.recruit.stage as keyof typeof stageOrder] || 99);
      }),
      // Sort first, then mark the first "no future" recruit so UI can show divider
      ...noFutureBlitzRecruits.sort((a, b) => {
        const yearOrder: Record<string, number> = { 'Rookie': 0, 'Sophomore': 1, 'Vet': 2 };
        const yearA = yearOrder[a.recruit.year || ''] ?? 99;
        const yearB = yearOrder[b.recruit.year || ''] ?? 99;
        if (yearA !== yearB) return yearA - yearB;
        const stageOrder = { 'Signed': 0, 'Shadow ✅': 1, 'Sold 💲': 2, 'Sold (5+) 💰': 3 };
        return (stageOrder[a.recruit.stage as keyof typeof stageOrder] || 99) - (stageOrder[b.recruit.stage as keyof typeof stageOrder] || 99);
      }).map((r, i) => ({
        ...r,
        showDivider: i === 0,
      })),
    ];

    if (combinedNoBlitz.length > 0) {
      categories.push({
        id: 'no-commitment',
        label: 'No Blitz',
        emoji: '⚠️',
        count: noBlitzRecruits.length, // Only count the "never attended" ones in the chip
        recruits: combinedNoBlitz,
        priority: 70,
      });
    }

    // 5. Hot Leads - Evaluating stage recruits, sorted by days since last contact (furthest first)
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
        daysSinceContact: daysSince ?? undefined,
      });
    });

    if (hotLeadRecruits.length > 0) {
      categories.push({
        id: 'hot-leads',
        label: 'Hot Leads',
        emoji: '🔥',
        count: hotLeadRecruits.length,
        // Sort by days since contact - furthest away at top (never contacted = highest priority)
        recruits: hotLeadRecruits.sort((a, b) => {
          const aDays = a.daysSinceContact ?? 999; // Never contacted = highest
          const bDays = b.daysSinceContact ?? 999;
          return bDays - aDays;
        }),
        priority: 90,
      });
    }

    // 6. Readiness - Rookies who are Signed or further AND have completed phase 1
    // At top: those missing preseason standards (training/MNL/role plays/books goals)
    // Show blitz commitments and FP+ goal/current, but blitz doesn't affect pace
    const readinessRecruits: AttentionRecruit[] = [];
    
    // Only rookies in Signed or later stages
    const rookiesForReadiness = recruits.filter(r => 
      r.year === 'Rookie' && 
      (r.stage === 'Signed' || r.stage === 'Shadow ✅' || r.stage === 'Sold 💲' || r.stage === 'Sold (5+) 💰')
    );
    
    rookiesForReadiness.forEach(recruit => {
      const repData = repDataMap?.get(recruit.notionPageId);
      
      // Must have completed phase 1 (check from repData if available)
      const phase1Complete = repData?.ramp_phase_1_complete ?? false;
      if (!phase1Complete) return;
      
      const userId = repData?.user_id;
      const goalsData = userId ? repGoalsMap?.get(userId) : undefined;
      const summerConfig = userId ? repSummerConfigMap?.get(userId) : undefined;
      const personalSummerStart = summerConfig?.personal_summer_start || null;
      
      // Get blitz commitments
      const rawCommitments = repData?.committed_blitzes || [];
      const committedBlitzIds: string[] = Array.isArray(rawCommitments)
        ? rawCommitments.map((b: string | { id: string }) => typeof b === 'string' ? b : b.id)
        : [];
      
      // Find future committed blitzes
      const futureCommittedBlitzes = blitzes.filter(b => {
        const blitzDate = parseISO(b.date);
        return blitzDate >= now && committedBlitzIds.includes(b.id);
      });
      
      // Get goal values - check which goals are MISSING (not set)
      const trainingGoal = (goalsData?.training_hours_goal || 0) * 60; // Convert hours to minutes
      const trainingProgress = goalsData?.training_hours_progress || 0;
      const booksGoal = goalsData?.books_goal || 0;
      const booksProgress = goalsData?.books_progress || 0;
      const rolePlaysGoal = goalsData?.role_plays_goal || 0;
      const rolePlaysProgress = goalsData?.role_plays_progress || 0;
      const mnlGoal = goalsData?.monday_night_lights_goal || 0;
      const mnlProgress = goalsData?.monday_night_lights_progress || 0;
      
      // Check which goals are MISSING (not set in app)
      const missingGoals: string[] = [];
      if (!goalsData?.training_hours_goal || goalsData.training_hours_goal === 0) missingGoals.push('Training');
      if (!goalsData?.monday_night_lights_goal || goalsData.monday_night_lights_goal === 0) missingGoals.push('MNL');
      if (!goalsData?.role_plays_goal || goalsData.role_plays_goal === 0) missingGoals.push('Role Plays');
      if (!goalsData?.books_goal || goalsData.books_goal === 0) missingGoals.push('Books');
      
      // Calculate pace status only for goals that ARE set (excluding blitz commitments)
      let behindCount = 0;
      const behindAreas: string[] = [];
      
      // Training hours use weekly pace (resets Sunday) - only if goal is set
      if (trainingGoal > 0) {
        const trainingPaceStatus = getCommitmentPaceStatus('training', trainingProgress, trainingGoal, personalSummerStart);
        if (trainingPaceStatus === 'behind') {
          behindCount++;
          behindAreas.push('Training');
        }
      }
      
      // Books use preseason pace (until summer start) - only if goal is set
      if (booksGoal > 0) {
        const booksPaceStatus = getCommitmentPaceStatus('books', booksProgress, booksGoal, personalSummerStart);
        if (booksPaceStatus === 'behind') {
          behindCount++;
          behindAreas.push('Books');
        }
      }
      
      // Role plays use preseason pace - only if goal is set
      if (rolePlaysGoal > 0) {
        const rolePLaysPaceStatus = getCommitmentPaceStatus('role_plays', rolePlaysProgress, rolePlaysGoal, personalSummerStart);
        if (rolePLaysPaceStatus === 'behind') {
          behindCount++;
          behindAreas.push('Role Plays');
        }
      }
      
      // MNL uses preseason pace - only if goal is set
      if (mnlGoal > 0) {
        const mnlPaceStatus = getCommitmentPaceStatus('monday_night_lights', mnlProgress, mnlGoal, personalSummerStart);
        if (mnlPaceStatus === 'behind') {
          behindCount++;
          behindAreas.push('MNL');
        }
      }
      
      // Get FP+ goal and current from recruit data
      const fpGoal = (recruit as any).personalFpGoal || 0;
      const fpCurrent = (recruit as any).personalFp || 0;
      
      const firstName = recruit.name?.split(' ')[0] || 'Rookie';
      let reason = '';
      let urgency: 'high' | 'medium' | 'low' = 'low';
      
      // Priority: missing goals > behind on pace > on track
      if (missingGoals.length > 0) {
        reason = `${firstName} needs to set ${missingGoals.slice(0, 2).join(' & ')}${missingGoals.length > 2 ? ` +${missingGoals.length - 2}` : ''} goals`;
        urgency = missingGoals.length >= 3 ? 'high' : 'medium';
      } else if (behindCount > 0) {
        reason = `${firstName} is behind on ${behindAreas.slice(0, 2).join(' & ')}${behindAreas.length > 2 ? ` +${behindAreas.length - 2}` : ''}`;
        urgency = behindCount >= 3 ? 'high' : behindCount >= 2 ? 'medium' : 'low';
      } else {
        // On track - not behind on any goals
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
          missingGoals,
          fpGoal,
          fpCurrent,
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
          // Sort: missing goals first (most missing first), then by behind count (most behind first)
          const aMissing = a.readinessProgress?.missingGoals?.length || 0;
          const bMissing = b.readinessProgress?.missingGoals?.length || 0;
          if (aMissing !== bMissing) return bMissing - aMissing;
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
