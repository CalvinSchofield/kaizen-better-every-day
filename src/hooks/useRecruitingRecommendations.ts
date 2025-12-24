import { useMemo } from "react";
import { Recruit, RecruitActivity } from "./useGroupRecruits";
import { parseISO, isAfter, format, isSameDay, startOfDay } from "date-fns";
import { getDaysUntilBlitz, getDaysSinceDate, getTodayDateString } from "@/utils/blitzDateUtils";

export interface RecruitRecommendation {
  recruit: Recruit;
  priority: number;
  reason: string;
  reasonBadge: 'blitz-critical' | 'blitz-prep' | 'signed' | 'hot-lead' | 'pipeline' | 'stale' | 'overdue';
  daysSinceContact: number | null;
  daysUntilBlitz?: number;
  missingItems?: string[];
  scheduledFollowUp?: {
    dueDate: Date;
    isDueToday: boolean;
    formattedDate: string;
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

// Stage-based cadence rules (days between contacts) - import from constants
import { STAGE_CADENCE, EXIT_STAGES, isStageIn } from "@/utils/stageConstants";

export const useRecruitingRecommendations = (
  recruits: Recruit[],
  activities: RecruitActivity[],
  blitzes?: BlitzEvent[],
  repDataMap?: Map<string, RepData>
) => {
  return useMemo(() => {
    if (!recruits.length) return [];

    const now = new Date();
    const recommendations: RecruitRecommendation[] = [];

    // Build a map of latest activity per recruit
    const lastContactMap = new Map<string, Date>();
    // Build a map of scheduled follow-ups (track the latest next_action_due per recruit)
    const scheduledFollowUpMap = new Map<string, { dueDate: Date; createdAt: Date }>();
    const today = startOfDay(now);
    
    activities.forEach(activity => {
      if (activity.activity_type === 'phone_call' || activity.activity_type === 'in_person') {
        const existing = lastContactMap.get(activity.rep_notion_page_id);
        const activityDate = parseISO(activity.created_at);
        if (!existing || activityDate > existing) {
          lastContactMap.set(activity.rep_notion_page_id, activityDate);
        }
      }
      
      // Track scheduled follow-ups (next_step with next_action_due)
      if (activity.activity_type === 'next_step' && activity.next_action_due) {
        const dueDate = parseISO(activity.next_action_due);
        const createdAt = parseISO(activity.created_at);
        const existing = scheduledFollowUpMap.get(activity.rep_notion_page_id);
        // Keep the most recently created scheduling
        if (!existing || createdAt > existing.createdAt) {
          scheduledFollowUpMap.set(activity.rep_notion_page_id, { dueDate, createdAt });
        }
      }
    });

    // Find upcoming blitzes within 21 days for blitz proximity checks
    const upcomingBlitzes = (blitzes || []).filter(b => {
      const daysUntil = getDaysUntilBlitz(b.date);
      return daysUntil !== null && daysUntil >= 0 && daysUntil <= 21;
    });

    recruits.forEach(recruit => {
      // EARLY EXIT: Skip anyone in exit stages (Not Interested, Signed but Not Interested, Potential Follow Up with no due date)
      // Potential Follow Up with a scheduled date will be handled separately via scheduledFollowUpMap
      if (isStageIn(recruit.stage, EXIT_STAGES)) {
        // Allow Potential Follow Up through ONLY if they have a scheduled follow-up due today
        if (recruit.stage !== 'Potential Follow Up') {
          return; // Skip Not Interested and Signed but Not Interested entirely
        }
      }
      
      const lastContact = lastContactMap.get(recruit.notionPageId);
      const lastContactStr = lastContact ? lastContact.toISOString().split('T')[0] : null;
      const daysSinceContact = lastContactStr ? getDaysSinceDate(lastContactStr) : null;
      
      // Check if recruit has a follow-up scheduled for AFTER today
      // If so, skip them - there's nothing to do until that date
      const scheduledFollowUpData = scheduledFollowUpMap.get(recruit.notionPageId);
      if (scheduledFollowUpData && isAfter(scheduledFollowUpData.dueDate, today)) {
        return; // Skip this recruit - there's nothing to do until that date
      }
      
      // Track if follow-up is due today for display
      let scheduledFollowUp: RecruitRecommendation['scheduledFollowUp'];
      if (scheduledFollowUpData && isSameDay(scheduledFollowUpData.dueDate, today)) {
        scheduledFollowUp = {
          dueDate: scheduledFollowUpData.dueDate,
          isDueToday: true,
          formattedDate: 'Today',
        };
      }
      
      const cadence = STAGE_CADENCE[recruit.stage] || 7;
      let priority = 0;
      let reason = '';
      let reasonBadge: RecruitRecommendation['reasonBadge'] = 'pipeline';
      let daysUntilBlitz: number | undefined;
      let missingItems: string[] | undefined;

      const isRookie = recruit.year === 'Rookie' || recruit.year === '2025';
      const firstName = recruit.name?.split(' ')[0] || 'Recruit';

      // Check for blitz proximity (only for Signed/Shadow ROOKIES - vets don't need blitz prep reminders)
      const isSignedOrShadow = recruit.stage === 'Signed' || recruit.stage === 'Shadow ✅';
      let hasUpcomingBlitz = false;
      let nearestBlitzDays: number | undefined;
      let nearestBlitzName: string | undefined;
      
      // Only check blitz urgency for rookies - vets already have trainings/onboarding done
      if (isSignedOrShadow && isRookie && blitzes) {
        // Use committedBlitzes directly from recruit object (populated in useGroupRecruits from reps table)
        let committedBlitzIds: string[] = [];
        
        // First try recruit's committedBlitzes from Supabase recruit_blitzes join
        if (recruit.committedBlitzes && recruit.committedBlitzes.length > 0) {
          committedBlitzIds = recruit.committedBlitzes.map((b: string | { id: string }) => 
            typeof b === 'string' ? b : b.id
          );
        }

        // Find nearest committed blitz
        // Check both Supabase ID and notion_page_id for backwards compatibility
        for (const blitz of upcomingBlitzes) {
          const blitzWithNotion = blitz as BlitzEvent & { notion_page_id?: string };
          const matchesId = committedBlitzIds.includes(blitz.id);
          const matchesNotionId = blitzWithNotion.notion_page_id && committedBlitzIds.includes(blitzWithNotion.notion_page_id);
          
          if (matchesId || matchesNotionId) {
            const days = getDaysUntilBlitz(blitz.date);
            if (days !== null && days >= 0 && (nearestBlitzDays === undefined || days < nearestBlitzDays)) {
              nearestBlitzDays = days;
              nearestBlitzName = blitz.name;
              hasUpcomingBlitz = true;
            }
          }
        }

        // Check for missing items - use recruit object fields directly (from Supabase via useGroupRecruits)
        // This ensures stable recommendations without waiting for repDataMap to load
        if (hasUpcomingBlitz || isRookie) {
          const missing: string[] = [];
          
          // Use recruit object's boolean fields (already populated from reps table in useGroupRecruits)
          if (!recruit.onboardingComplete) missing.push('Onboarding');
          if (!recruit.trainingsComplete) missing.push('Trainings');
          if (!recruit.slackJoined) missing.push('Slack');
          if (!recruit.ipadAssigned) missing.push('iPad');
          
          // Check ramp to blitz phases from recruit object
          const phase1 = recruit.phase1Complete ?? false;
          const phase2 = recruit.phase2Complete ?? false;
          const phase3 = recruit.phase3Complete ?? false;
          const phase4 = recruit.phase4Complete ?? false;
          
          const incompletePhaseCount = [phase1, phase2, phase3, phase4].filter(p => !p).length;
          if (incompletePhaseCount > 0) {
            missing.push(`${incompletePhaseCount} ramp phase${incompletePhaseCount > 1 ? 's' : ''}`);
          }
          
          if (missing.length > 0) {
            missingItems = missing;
          }
        }
      }

      // TIER 0: Signed/Shadow with blitz < 21 days + MISSING ITEMS (CRITICAL)
      if (isSignedOrShadow && hasUpcomingBlitz && missingItems && missingItems.length > 0) {
        daysUntilBlitz = nearestBlitzDays;
        // Higher priority for fewer days and more missing items
        priority = 250 - (nearestBlitzDays || 0) + (missingItems.length * 5);
        const missingText = missingItems.length === 1 
          ? missingItems[0]
          : missingItems.slice(0, 2).join(' & ') + (missingItems.length > 2 ? ` +${missingItems.length - 2}` : '');
        reason = `URGENT: ${firstName} has blitz in ${nearestBlitzDays}d but needs ${missingText}`;
        reasonBadge = 'blitz-critical';
      }
      // TIER 1: Signed/Shadow with blitz < 21 days (ready but check in)
      else if (isSignedOrShadow && hasUpcomingBlitz) {
        daysUntilBlitz = nearestBlitzDays;
        // Only show if contact is due (7+ days)
        if (daysSinceContact === null || daysSinceContact >= 5) {
          priority = 150 - (nearestBlitzDays || 0);
          reason = `${firstName} has blitz in ${nearestBlitzDays}d—check in before they go!`;
          reasonBadge = 'blitz-prep';
        }
      }
      // TIER 2: Signed/Shadow needing weekly contact (no blitz urgency)
      else if (isSignedOrShadow) {
        if (daysSinceContact === null || daysSinceContact >= 7) {
          const rookieBoost = isRookie ? 50 : 0;
          priority = 100 + rookieBoost - (daysSinceContact || 30);
          reason = isRookie 
            ? `Check in with ${firstName}—weekly rookie touch base` 
            : `Weekly check-in with ${firstName}`;
          reasonBadge = 'signed';
        }
      }
      // TIER 3: Evaluating (hot leads) - rookies get priority boost
      else if (recruit.stage === 'Evaluating') {
        if (daysSinceContact === null || daysSinceContact >= 3) {
          const rookieBoost = isRookie ? 30 : 0;
          priority = 80 + rookieBoost - (daysSinceContact || 20);
          reason = daysSinceContact !== null 
            ? `${firstName} is hot—${daysSinceContact}d since contact, follow up!`
            : `${firstName} is evaluating—reach out and close!`;
          reasonBadge = 'hot-lead';
        }
      }
      // TIER 4: 100 List (never contacted) - rookies get priority boost
      else if (recruit.stage === '100 List' && daysSinceContact === null) {
        const rookieBoost = isRookie ? 20 : 0;
        priority = 40 + rookieBoost;
        reason = `Time to reach out to ${firstName}`;
        reasonBadge = 'pipeline';
      }
      // TIER 5: Stale contacts (any stage, 14+ days) - rookies get priority boost
      else if (daysSinceContact !== null && daysSinceContact >= 14) {
        const rookieBoost = isRookie ? 25 : 0;
        priority = 20 + rookieBoost + Math.min(daysSinceContact, 30);
        reason = `${firstName} needs attention—${daysSinceContact}d since contact`;
        reasonBadge = 'stale';
      }
      // TIER 6: Overdue based on cadence - rookies get priority boost
      else if (daysSinceContact !== null && daysSinceContact >= cadence) {
        const rookieBoost = isRookie ? 20 : 0;
        priority = 30 + rookieBoost;
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
          daysUntilBlitz,
          missingItems,
          scheduledFollowUp,
        });
      }
    });

    // Sort by priority (highest first)
    return recommendations.sort((a, b) => b.priority - a.priority);
  }, [recruits, activities, blitzes, repDataMap]);
};
