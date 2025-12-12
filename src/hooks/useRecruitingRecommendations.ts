import { useMemo } from "react";
import { Recruit, RecruitActivity } from "./useGroupRecruits";
import { differenceInDays, parseISO, startOfDay, isAfter } from "date-fns";

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

    // Debug logging for development
    console.log('[Recommendations] Processing', recruits.length, 'recruits with', blitzes?.length || 0, 'blitzes');

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
      const blitzDate = parseISO(b.date);
      const daysUntil = differenceInDays(blitzDate, now);
      return daysUntil >= 0 && daysUntil <= 21;
    });
    
    console.log('[Recommendations] Upcoming blitzes (within 21 days):', upcomingBlitzes.map(b => ({ id: b.id, name: b.name, date: b.date })));

    recruits.forEach(recruit => {
      const lastContact = lastContactMap.get(recruit.notionPageId);
      const daysSinceContact = lastContact 
        ? differenceInDays(now, lastContact)
        : null;
      
      // Check if recruit has a follow-up scheduled for AFTER today
      // If so, skip them - there's nothing to do until that date
      const scheduledFollowUp = scheduledFollowUpMap.get(recruit.notionPageId);
      if (scheduledFollowUp && isAfter(scheduledFollowUp.dueDate, today)) {
        console.log(`[Recommendations] Skipping ${recruit.name} - follow-up scheduled for ${scheduledFollowUp.dueDate.toISOString().split('T')[0]}`);
        return; // Skip this recruit
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
        const repData = repDataMap?.get(recruit.notionPageId);
        
        // Use committedBlitzes from Notion (recruit object) OR from reps table (repData)
        let committedBlitzIds: string[] = [];
        
        // First try recruit's committedBlitzes from Notion (most reliable)
        // Note: From Notion, this could be string[] (IDs) or BlitzCommitment[] (objects)
        if (recruit.committedBlitzes && recruit.committedBlitzes.length > 0) {
          committedBlitzIds = recruit.committedBlitzes.map((b: string | { id: string }) => 
            typeof b === 'string' ? b : b.id
          );
        } 
        // Fall back to repData.committed_blitzes from reps table
        else if (repData) {
          const rawCommitments = repData.committed_blitzes || [];
          committedBlitzIds = Array.isArray(rawCommitments)
            ? rawCommitments.map((b: string | { id: string }) => typeof b === 'string' ? b : b.id)
            : [];
        }

        // Debug logging for blitz matching
        if (committedBlitzIds.length > 0) {
          console.log(`[Recommendations] ${recruit.name} (${recruit.stage}) has committedBlitzIds:`, committedBlitzIds, 'hasRepData:', !!repData);
        }

        // Find nearest committed blitz
        for (const blitz of upcomingBlitzes) {
          if (committedBlitzIds.includes(blitz.id)) {
            const days = differenceInDays(parseISO(blitz.date), now);
            console.log(`[Recommendations] ${recruit.name} matches blitz ${blitz.name} in ${days} days`);
            if (nearestBlitzDays === undefined || days < nearestBlitzDays) {
              nearestBlitzDays = days;
              nearestBlitzName = blitz.name;
              hasUpcomingBlitz = true;
            }
          }
        }

        // Check for missing items - use repData if available, fall back to Notion data
        if (hasUpcomingBlitz) {
          const missing: string[] = [];
          
          if (repData) {
            // Use detailed repData from Supabase reps table
            if (!repData.onboarding_complete) missing.push('Onboarding');
            if (!repData.trainings_complete) missing.push('Trainings');
            if (!repData.slack_joined) missing.push('Slack');
            if (!repData.ipad_assigned) missing.push('iPad');
            
            // Check ramp to blitz phases
            const phase1 = repData.ramp_phase_1_complete ?? false;
            const phase2 = repData.ramp_phase_2_complete ?? false;
            const phase3 = repData.ramp_phase_3_complete ?? false;
            const phase4 = repData.ramp_phase_4_complete ?? false;
            
            const incompletePhaseCount = [phase1, phase2, phase3, phase4].filter(p => !p).length;
            if (incompletePhaseCount > 0) {
              missing.push(`${incompletePhaseCount} ramp phase${incompletePhaseCount > 1 ? 's' : ''}`);
            }
          } else {
            // Fall back to Notion-sourced data from recruit object
            // Check onboarding status - Phase 4 or Blitz Ready means complete (handle variations)
            const statusLower = (recruit.onboardingStatus || '').toLowerCase();
            const onboardingComplete = statusLower.includes('phase 4') || 
                                       statusLower.includes('blitz ready') ||
                                       recruit.blitzReady === true;
            if (!onboardingComplete) missing.push('Onboarding');
            if (!recruit.ipadAssigned) missing.push('iPad');
            // Can't check individual ramp phases from Notion, but blitzReady covers that
          }
          
          if (missing.length > 0) {
            missingItems = missing;
          }
        }
        // Also check for missing items even if no blitz committed (for general awareness)
        else if (isRookie) {
          const missing: string[] = [];
          
          if (repData) {
            if (!repData.onboarding_complete) missing.push('Onboarding');
            if (!repData.trainings_complete) missing.push('Trainings');
            if (!repData.slack_joined) missing.push('Slack');
            if (!repData.ipad_assigned) missing.push('iPad');
            
            const phase1 = repData.ramp_phase_1_complete ?? false;
            const phase2 = repData.ramp_phase_2_complete ?? false;
            const phase3 = repData.ramp_phase_3_complete ?? false;
            const phase4 = repData.ramp_phase_4_complete ?? false;
            
            const incompletePhaseCount = [phase1, phase2, phase3, phase4].filter(p => !p).length;
            if (incompletePhaseCount > 0) {
              missing.push(`${incompletePhaseCount} ramp phase${incompletePhaseCount > 1 ? 's' : ''}`);
            }
          } else {
            // Fall back to Notion-sourced data
            // Check for variations of "Blitz ready" status (with/without emoji, capitalization)
            const statusLower = (recruit.onboardingStatus || '').toLowerCase();
            const onboardingComplete = statusLower.includes('phase 4') || 
                                       statusLower.includes('blitz ready') ||
                                       recruit.blitzReady === true;
            if (!onboardingComplete) missing.push('Onboarding');
            if (!recruit.ipadAssigned) missing.push('iPad');
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
