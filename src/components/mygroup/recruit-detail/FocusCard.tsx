import { useMemo } from "react";
import { differenceInDays, parseISO, isAfter, isSameDay, startOfToday } from "date-fns";
import { formatDaysUntilBlitz } from "@/utils/blitzDateUtils";
import { 
  AlertTriangle, 
  Tablet, 
  Clock, 
  Target, 
  Plane,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Phone
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Recruit } from "@/hooks/useGroupRecruits";
import { RecruitRepData, RecruitGoals, FocusIssue, TabType } from "./types";
import { getFirstName } from "./utils";
import { useBlitzes } from "@/hooks/useBlitzes";

interface FocusCardProps {
  recruit: Recruit;
  recruitRepData: RecruitRepData | null;
  recruitGoals: RecruitGoals | null;
  recruitYtdFP?: number;
  onNavigateToTab: (tab: TabType) => void;
  onAssignIpad?: () => void;
}

export const FocusCard = ({ 
  recruit, 
  recruitRepData, 
  recruitGoals,
  recruitYtdFP = 0,
  onNavigateToTab,
  onAssignIpad
}: FocusCardProps) => {
  const { allBlitzes } = useBlitzes();
  const recruitFirstName = getFirstName(recruit.name);
  
  // Calculate closest upcoming blitz from committed blitzes
  const closestBlitz = useMemo(() => {
    if (!recruitRepData?.committed_blitzes || !allBlitzes.length) return null;
    
    const committedIds = (recruitRepData.committed_blitzes as (string | { id: string })[])
      .map(b => typeof b === 'string' ? b : b.id);
    
    if (committedIds.length === 0) return null;
    
    const today = startOfToday();
    
    const committedUpcoming = allBlitzes
      .filter(blitz => committedIds.includes(blitz.id))
      .filter(blitz => {
        if (!blitz.date) return false;
        const blitzDate = parseISO(blitz.date);
        return isAfter(blitzDate, today) || isSameDay(blitzDate, today);
      })
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
    
    if (committedUpcoming.length === 0) return null;
    
    const closest = committedUpcoming[0];
    const daysUntil = differenceInDays(parseISO(closest.date), today);
    
    return { name: closest.name, daysUntil };
  }, [recruitRepData?.committed_blitzes, allBlitzes]);
  
  const focusIssue = useMemo((): FocusIssue | null => {
    if (!recruitRepData) return null;
    
    const issues: FocusIssue[] = [];
    const now = new Date();
    
    // Check if recruit is in a stage where iPad matters (Signed+, excluding exit stages)
    const stageLower = (recruit.stage || '').toLowerCase();
    const earlyStages = ['100_list', '100 list', 'evaluating', 'reached_out', 'reached out'];
    const exitStages = ['not interested', 'potential follow up', 'signed but not interested'];
    const isEarlyStage = earlyStages.some(s => stageLower.includes(s));
    const isExitStage = exitStages.some(s => stageLower.includes(s));
    const isSignedOrBeyond = !isEarlyStage && !isExitStage;
    
    // Parse committed blitzes
    const committedBlitzIds = (() => {
      const raw = recruitRepData.committed_blitzes;
      if (!raw || !Array.isArray(raw)) return [];
      return raw.map((item: string | { id: string }) => 
        typeof item === 'string' ? item : item?.id
      ).filter(Boolean) as string[];
    })();
    
    const hasBlitzCommitment = committedBlitzIds.length > 0;
    const daysToBlitz = closestBlitz?.daysUntil ?? null;
    const isBlitzApproaching = daysToBlitz !== null && daysToBlitz >= 0 && daysToBlitz <= 21;
    const isBlitzImminent = daysToBlitz !== null && daysToBlitz >= 0 && daysToBlitz <= 7;
    
    const isRookie = recruitRepData.year === 'Rookie' || recruitRepData.year === '2025' || recruitRepData.year === '2026' || !recruitRepData.year;
    const isSophOrVet = !isRookie;
    
    // If any ramp phase is complete, onboarding is done (can't start ramp without completing onboarding)
    const hasAnyRampProgress = recruitRepData.ramp_phase_1_complete || 
      recruitRepData.ramp_phase_2_complete || 
      recruitRepData.ramp_phase_3_complete || 
      recruitRepData.ramp_phase_4_complete;
    const isOnboardingComplete = recruitRepData.onboarding_complete === true || hasAnyRampProgress;
    const isTrainingsComplete = recruitRepData.trainings_complete === true || hasAnyRampProgress;
    const isSlackJoined = recruitRepData.slack_joined === true || hasAnyRampProgress;
    const isRampPhase4Complete = recruitRepData.ramp_phase_4_complete === true;
    const hasIpad = recruitRepData.ipad_assigned === true;
    
    // Get current ramp phase
    const getCurrentRampPhase = () => {
      if (recruitRepData.ramp_phase_4_complete) return 'Complete';
      if (recruitRepData.ramp_phase_3_complete) return 'Phase 4';
      if (recruitRepData.ramp_phase_2_complete) return 'Phase 3';
      if (recruitRepData.ramp_phase_1_complete) return 'Phase 2';
      if (recruitRepData.slack_joined) return 'Phase 1';
      return 'Onboarding';
    };
    
    // Calculate days since last contact
    const daysSinceContact = recruit.lastContact 
      ? differenceInDays(now, parseISO(recruit.lastContact))
      : null;
    
    // ========== SOPHS & VETS: Always show goal progress ==========
    
    if (isSophOrVet && isSignedOrBeyond) {
      // Check if they have a preseason goal
      const hasPreseasonGoal = recruitGoals?.preseason_fp_goal && recruitGoals.preseason_fp_goal > 0;
      
      if (hasPreseasonGoal) {
        const goal = recruitGoals.preseason_fp_goal!;
        const progressPercent = Math.min((recruitYtdFP / goal) * 100, 100);
        issues.push({
          priority: 50,
          type: 'low',
          icon: 'target',
          title: `Goal Progress`,
          description: `${recruitYtdFP.toFixed(1)} / ${goal} EFP (${progressPercent.toFixed(0)}%)`,
          actionTab: 'details'
        });
      } else {
        issues.push({
          priority: 55,
          type: 'medium',
          icon: 'target',
          title: `No preseason goal set`,
          description: `Help ${recruitFirstName} set a goal to track progress`,
          actionLabel: 'View Details',
          actionTab: 'details'
        });
      }
      
      // Still check for stale contact for sophs/vets
      if (daysSinceContact && daysSinceContact >= 14) {
        issues.push({
          priority: 60,
          type: 'medium',
          icon: 'clock',
          title: `${daysSinceContact} days since last contact`,
          description: `Time to check in with ${recruitFirstName}`,
          actionLabel: 'View Activity',
          actionTab: 'activity'
        });
      }
      
      // Sort by priority and return highest
      issues.sort((a, b) => b.priority - a.priority);
      return issues[0] || null;
    }
    
    // ========== EARLY STAGE: Focus on moving toward Signed ==========
    
    if (isEarlyStage) {
      const stage = recruit.stage || '';
      
      if (stageLower.includes('100') || stageLower.includes('list')) {
        // 100 List - need to reach out
        if (daysSinceContact === null) {
          issues.push({
            priority: 80,
            type: 'high',
            icon: 'phone',
            title: 'Ready to reach out',
            description: `${recruitFirstName} is on your 100 list - time to make first contact`,
            actionLabel: 'Log Contact',
            actionTab: 'activity'
          });
        } else if (daysSinceContact >= 7) {
          issues.push({
            priority: 75,
            type: 'medium',
            icon: 'clock',
            title: `${daysSinceContact} days since contact`,
            description: `Follow up with ${recruitFirstName} to gauge interest`,
            actionLabel: 'Log Contact',
            actionTab: 'activity'
          });
        } else {
          issues.push({
            priority: 40,
            type: 'low',
            icon: 'target',
            title: 'Recently contacted',
            description: `Contacted ${daysSinceContact} day${daysSinceContact === 1 ? '' : 's'} ago - waiting for response`,
            actionTab: 'activity'
          });
        }
      } else if (stageLower.includes('reached') || stageLower.includes('out')) {
        // Reached Out - need to follow up and evaluate
        if (daysSinceContact && daysSinceContact >= 5) {
          issues.push({
            priority: 70,
            type: 'high',
            icon: 'clock',
            title: `${daysSinceContact} days since contact`,
            description: `Follow up with ${recruitFirstName} to move forward`,
            actionLabel: 'Log Contact',
            actionTab: 'activity'
          });
        } else {
          issues.push({
            priority: 50,
            type: 'medium',
            icon: 'target',
            title: 'Waiting for response',
            description: `${recruitFirstName} was reached out to - follow up to start evaluation`,
            actionLabel: 'Log Contact',
            actionTab: 'activity'
          });
        }
      } else if (stageLower.includes('evaluat')) {
        // Evaluating - need to close them
        if (daysSinceContact && daysSinceContact >= 3) {
          issues.push({
            priority: 75,
            type: 'high',
            icon: 'clock',
            title: `${daysSinceContact} days since contact`,
            description: `Stay in touch with ${recruitFirstName} while they're deciding`,
            actionLabel: 'Log Contact',
            actionTab: 'activity'
          });
        } else {
          issues.push({
            priority: 60,
            type: 'medium',
            icon: 'target',
            title: 'Actively evaluating',
            description: `${recruitFirstName} is considering - help them make a decision`,
            actionLabel: 'View Activity',
            actionTab: 'activity'
          });
        }
      }
      
      // Return early for early-stage recruits - don't show other warnings
      issues.sort((a, b) => b.priority - a.priority);
      return issues[0] || null;
    }
    
    // ========== CRITICAL: Blitz approaching with blockers (only for Signed+) ==========
    
    if (isSignedOrBeyond && hasBlitzCommitment && isBlitzImminent && !hasIpad) {
      const blitzTimeLabel = formatDaysUntilBlitz(daysToBlitz);
      issues.push({
        priority: 100,
        type: 'critical',
        icon: 'tablet',
        title: `No iPad with blitz ${blitzTimeLabel}!`,
        description: `${recruitFirstName} needs an iPad assigned before ${closestBlitz?.name || 'the blitz'}`,
        actionLabel: 'Assign iPad',
        actionTab: 'details'
      });
    }
    
    if (isSignedOrBeyond && hasBlitzCommitment && isBlitzImminent && !isRampPhase4Complete && isRookie) {
      const blitzTimeLabel = formatDaysUntilBlitz(daysToBlitz);
      issues.push({
        priority: 98,
        type: 'critical',
        icon: 'graduation',
        title: `Ramp incomplete with blitz ${blitzTimeLabel}!`,
        description: `${recruitFirstName} is on ${getCurrentRampPhase()} - needs to complete Ramp to Blitz`,
        actionLabel: 'View Progress',
        actionTab: 'progress'
      });
    }
    
    if (isSignedOrBeyond && hasBlitzCommitment && isBlitzImminent && !isOnboardingComplete && isRookie) {
      const blitzTimeLabel = formatDaysUntilBlitz(daysToBlitz);
      issues.push({
        priority: 97,
        type: 'critical',
        icon: 'alert',
        title: `Onboarding incomplete with blitz ${blitzTimeLabel}!`,
        description: `${recruitFirstName} hasn't finished onboarding yet`,
        actionLabel: 'View Progress',
        actionTab: 'progress'
      });
    }
    
    // ========== HIGH: Blitz approaching with issues (only for Signed+) ==========
    
    if (isSignedOrBeyond && hasBlitzCommitment && isBlitzApproaching && !isBlitzImminent && !hasIpad) {
      const blitzTimeLabel = formatDaysUntilBlitz(daysToBlitz);
      issues.push({
        priority: 85,
        type: 'high',
        icon: 'tablet',
        title: `No iPad assigned`,
        description: `${recruitFirstName} has blitz ${blitzTimeLabel} but no iPad`,
        actionLabel: 'Assign iPad',
        actionTab: 'details'
      });
    }
    
    if (isSignedOrBeyond && hasBlitzCommitment && isBlitzApproaching && !isBlitzImminent && !isRampPhase4Complete && isRookie) {
      const blitzTimeLabel = formatDaysUntilBlitz(daysToBlitz);
      issues.push({
        priority: 83,
        type: 'high',
        icon: 'graduation',
        title: `Ramp to Blitz incomplete`,
        description: `${recruitFirstName} is on ${getCurrentRampPhase()} with blitz ${blitzTimeLabel}`,
        actionLabel: 'View Progress',
        actionTab: 'progress'
      });
    }
    
    // ========== HIGH: No blitz but missing critical items (only for Signed+) ==========
    
    if (isSignedOrBeyond && !hasIpad && isRookie && !isRampPhase4Complete) {
      issues.push({
        priority: 70,
        type: 'high',
        icon: 'tablet',
        title: `No iPad assigned`,
        description: `${recruitFirstName} needs an iPad before they can go to a blitz`,
        actionLabel: 'Assign iPad',
        actionTab: 'details'
      });
    }
    
    if (isSignedOrBeyond && !isOnboardingComplete && isRookie) {
      issues.push({
        priority: 65,
        type: 'high',
        icon: 'alert',
        title: `Onboarding not started`,
        description: `${recruitFirstName} hasn't completed the onboarding video yet`,
        actionLabel: 'View Progress',
        actionTab: 'progress'
      });
    }
    
    if (isSignedOrBeyond && isSlackJoined && !isRampPhase4Complete && isRookie) {
      issues.push({
        priority: 60,
        type: 'medium',
        icon: 'graduation',
        title: `In Ramp to Blitz: ${getCurrentRampPhase()}`,
        description: `${recruitFirstName} is working through the ramp process`,
        actionLabel: 'View Progress',
        actionTab: 'progress'
      });
    }
    
    // ========== MEDIUM: Stale contact ==========
    
    if (daysSinceContact && daysSinceContact >= 14) {
      issues.push({
        priority: 50,
        type: 'medium',
        icon: 'clock',
        title: `${daysSinceContact} days since last contact`,
        description: `Time to check in with ${recruitFirstName}`,
        actionLabel: 'View Activity',
        actionTab: 'activity'
      });
    }
    
    // ========== LOW: All good! ==========
    
    // Check if recruit has a past blitz (post-blitz state)
    const hasPastBlitz = (() => {
      if (!recruitRepData?.committed_blitzes || !Array.isArray(recruitRepData.committed_blitzes)) return false;
      const committedIds = (recruitRepData.committed_blitzes as (string | { id: string })[])
        .map(b => typeof b === 'string' ? b : b.id);
      if (committedIds.length === 0) return false;
      
      // Check if any committed blitz has ended (end_date in the past)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Import allBlitzes context isn't available here, so we check via closestBlitz
      // If they're blitz ready but no upcoming blitz, they must have completed one
      return isRampPhase4Complete && hasIpad && !closestBlitz;
    })();
    
    // Post-blitz: Show goal progress instead of "Blitz ready!"
    if (hasPastBlitz || (isRampPhase4Complete && hasIpad && !hasBlitzCommitment)) {
      // Check if they have a preseason goal
      const hasPreseasonGoal = recruitGoals?.preseason_fp_goal && recruitGoals.preseason_fp_goal > 0;
      
      if (hasPreseasonGoal) {
        const goal = recruitGoals.preseason_fp_goal!;
        const progressPercent = Math.min((recruitYtdFP / goal) * 100, 100);
        issues.push({
          priority: 10,
          type: 'low',
          icon: 'target',
          title: `Goal Progress`,
          description: `${recruitYtdFP.toFixed(1)} / ${goal} EFP (${progressPercent.toFixed(0)}%)`,
          actionTab: 'progress'
        });
      } else {
        issues.push({
          priority: 15,
          type: 'medium',
          icon: 'target',
          title: `No preseason goal set`,
          description: `Help ${recruitFirstName} set a goal to track progress`,
          actionLabel: 'View Progress',
          actionTab: 'progress'
        });
      }
    } else if (isRampPhase4Complete && hasIpad) {
      issues.push({
        priority: 10,
        type: 'low',
        icon: 'check',
        title: `Blitz ready!`,
        description: `${recruitFirstName} has completed all prep and is ready to go`,
        actionTab: 'details'
      });
    }
    
    // Sort by priority and return highest
    issues.sort((a, b) => b.priority - a.priority);
    return issues[0] || null;
  }, [recruit, recruitRepData, recruitFirstName, closestBlitz, recruitGoals, recruitYtdFP]);
  
  if (!focusIssue) return null;
  
  const getIcon = () => {
    switch (focusIssue.icon) {
      case 'tablet': return <Tablet className="h-5 w-5" />;
      case 'graduation': return <GraduationCap className="h-5 w-5" />;
      case 'alert': return <AlertCircle className="h-5 w-5" />;
      case 'clock': return <Clock className="h-5 w-5" />;
      case 'check': return <CheckCircle2 className="h-5 w-5" />;
      case 'plane': return <Plane className="h-5 w-5" />;
      case 'phone': return <Phone className="h-5 w-5" />;
      case 'target': return <Target className="h-5 w-5" />;
      default: return <AlertTriangle className="h-5 w-5" />;
    }
  };
  
  const getColorClasses = () => {
    switch (focusIssue.type) {
      case 'critical': return 'bg-destructive/10 border-destructive/30 text-destructive';
      case 'high': return 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400';
      case 'medium': return 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400';
      case 'low': return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400';
    }
  };
  
  const getBadgeVariant = () => {
    switch (focusIssue.type) {
      case 'critical': return 'destructive';
      case 'high': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className={`rounded-xl border p-4 ${getColorClasses()}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-sm">{focusIssue.title}</h4>
            {focusIssue.type === 'critical' && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                URGENT
              </Badge>
            )}
          </div>
          <p className="text-xs opacity-80">{focusIssue.description}</p>
        </div>
        {focusIssue.actionLabel && focusIssue.actionTab && (
          <Button 
            size="sm" 
            variant={focusIssue.type === 'critical' ? 'destructive' : 'secondary'}
            className="shrink-0 text-xs h-8"
            onClick={() => {
              // If this is an iPad assignment action, call onAssignIpad directly
              if (focusIssue.actionLabel === 'Assign iPad' && onAssignIpad) {
                onAssignIpad();
              } else {
                onNavigateToTab(focusIssue.actionTab!);
              }
            }}
          >
            {focusIssue.actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
};
