import { useMemo } from "react";
import { Recruit, RecruitActivity } from "./useGroupRecruits";
import { differenceInDays, parseISO } from "date-fns";

export interface RecruitRecommendation {
  recruit: Recruit;
  priority: number;
  reason: string;
  reasonBadge: 'blitz-critical' | 'blitz-prep' | 'signed' | 'hot-lead' | 'pipeline' | 'stale' | 'overdue';
  daysSinceContact: number | null;
  daysUntilBlitz?: number;
  missingItems?: string[];
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
    activities.forEach(activity => {
      if (activity.activity_type === 'phone_call' || activity.activity_type === 'in_person') {
        const existing = lastContactMap.get(activity.rep_notion_page_id);
        const activityDate = parseISO(activity.created_at);
        if (!existing || activityDate > existing) {
          lastContactMap.set(activity.rep_notion_page_id, activityDate);
        }
      }
    });

    // Find upcoming blitzes within 21 days for blitz proximity checks
    const upcomingBlitzes = (blitzes || []).filter(b => {
      const blitzDate = parseISO(b.date);
      const daysUntil = differenceInDays(blitzDate, now);
      return daysUntil >= 0 && daysUntil <= 21;
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
      let daysUntilBlitz: number | undefined;
      let missingItems: string[] | undefined;

      const isRookie = recruit.year === 'Rookie' || recruit.year === '2025';
      const firstName = recruit.name?.split(' ')[0] || 'Recruit';

      // Check for blitz proximity - for ALL rookies (not just Signed/Shadow)
      const isSignedOrShadow = recruit.stage === 'Signed' || recruit.stage === 'Shadow ✅';
      let hasUpcomingBlitz = false;
      let nearestBlitzDays: number | undefined;
      let nearestBlitzName: string | undefined;
      
      // Check blitz proximity for ALL rookies with committed blitzes
      if (isRookie && blitzes) {
        const repData = repDataMap?.get(recruit.notionPageId);
        
        // Use committedBlitzes from Notion (recruit object) OR from reps table (repData)
        let committedBlitzIds: string[] = [];
        
        // First try recruit's committedBlitzes from Notion (most reliable)
        if (recruit.committedBlitzes && recruit.committedBlitzes.length > 0) {
          committedBlitzIds = recruit.committedBlitzes.map(b => b.id);
        } 
        // Fall back to repData.committed_blitzes from reps table
        else if (repData) {
          const rawCommitments = repData.committed_blitzes || [];
          committedBlitzIds = Array.isArray(rawCommitments)
            ? rawCommitments.map((b: string | { id: string }) => typeof b === 'string' ? b : b.id)
            : [];
        }

        // Find nearest committed blitz
        for (const blitz of upcomingBlitzes) {
          if (committedBlitzIds.includes(blitz.id)) {
            const days = differenceInDays(parseISO(blitz.date), now);
            if (nearestBlitzDays === undefined || days < nearestBlitzDays) {
              nearestBlitzDays = days;
              nearestBlitzName = blitz.name;
              hasUpcomingBlitz = true;
            }
          }
        }

        // Check for missing items - include onboarding AND ramp to blitz progress
        // Use repData if available (Supabase user), otherwise use recruit data from Notion
        const missing: string[] = [];
        
        // Get onboarding/ramp data from repData OR recruit (Notion)
        const onboardingComplete = repData?.onboarding_complete ?? recruit.onboardingComplete ?? false;
        const trainingsComplete = repData?.trainings_complete ?? recruit.trainingsComplete ?? false;
        const slackJoined = repData?.slack_joined ?? recruit.slackJoined ?? false;
        const ipadAssigned = repData?.ipad_assigned ?? recruit.ipadAssigned ?? false;
        const phase1 = repData?.ramp_phase_1_complete ?? recruit.rampPhase1Complete ?? false;
        const phase2 = repData?.ramp_phase_2_complete ?? recruit.rampPhase2Complete ?? false;
        const phase3 = repData?.ramp_phase_3_complete ?? recruit.rampPhase3Complete ?? false;
        const phase4 = repData?.ramp_phase_4_complete ?? recruit.rampPhase4Complete ?? false;
        
        // Check foundational onboarding items
        if (!onboardingComplete) missing.push('Onboarding');
        if (!trainingsComplete) missing.push('Trainings');
        if (!slackJoined) missing.push('Slack');
        if (!ipadAssigned) missing.push('iPad');
        
        // Check ramp to blitz phases - count incomplete ones
        const incompletePhaseCount = [phase1, phase2, phase3, phase4].filter(p => !p).length;
        if (incompletePhaseCount > 0) {
          missing.push(`${incompletePhaseCount} ramp phase${incompletePhaseCount > 1 ? 's' : ''}`);
        }
        
        if (missing.length > 0) {
          missingItems = missing;
        }
      }

      // TIER 0: ANY rookie with blitz < 21 days + MISSING ITEMS (CRITICAL)
      // This is the highest priority - rookies who have committed blitzes but aren't ready
      if (isRookie && hasUpcomingBlitz && missingItems && missingItems.length > 0) {
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
      // TIER 3: Evaluating (hot leads)
      else if (recruit.stage === 'Evaluating') {
        if (daysSinceContact === null || daysSinceContact >= 3) {
          priority = 80 - (daysSinceContact || 20);
          reason = daysSinceContact !== null 
            ? `${firstName} is hot—${daysSinceContact}d since contact, follow up!`
            : `${firstName} is evaluating—reach out and close!`;
          reasonBadge = 'hot-lead';
        }
      }
      // TIER 4: 100 List (never contacted)
      else if (recruit.stage === '100 List' && daysSinceContact === null) {
        priority = 40;
        reason = `Time to reach out to ${firstName}`;
        reasonBadge = 'pipeline';
      }
      // TIER 5: Stale contacts (any stage, 14+ days)
      else if (daysSinceContact !== null && daysSinceContact >= 14) {
        priority = 20 + Math.min(daysSinceContact, 30);
        reason = `${firstName} needs attention—${daysSinceContact}d since contact`;
        reasonBadge = 'stale';
      }
      // TIER 6: Overdue based on cadence
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
          daysUntilBlitz,
          missingItems,
        });
      }
    });

    // Sort by priority (highest first)
    return recommendations.sort((a, b) => b.priority - a.priority);
  }, [recruits, activities, blitzes, repDataMap]);
};
