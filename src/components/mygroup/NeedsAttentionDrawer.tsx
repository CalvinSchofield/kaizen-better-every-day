import { useState } from "react";
import { Phone, MessageSquare, ChevronRight, CheckCircle2, Circle, Tablet, BookOpen, MessageCircle, GraduationCap, Loader2, Mail, Calendar, Clock, Theater, Moon, Plane, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerFooter
} from "@/components/ui/drawer";
import { AttentionCategory, AttentionRecruit } from "@/hooks/useNeedsAttention";
import { Recruit, useLogRecruitActivity } from "@/hooks/useGroupRecruits";
import { useUpdateRookieStatus } from "@/hooks/useUpdateRookieStatus";
import { SwipeableRecruitItem } from "./SwipeableRecruitItem";
import { SwipeableBlitzItem } from "./SwipeableBlitzItem";
import { ScheduleFollowUpDrawer } from "./ScheduleFollowUpDrawer";
import { ContactMethodDrawer } from "./ContactMethodDrawer";
import { PostContactDrawer } from "./PostContactDrawer";
import { BlitzCommitmentDrawer } from "./BlitzCommitmentDrawer";
import { PhaseVerificationDrawer } from "./PhaseVerificationDrawer";
import { AddPhoneDrawer } from "@/components/ui/AddPhoneDrawer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { generateSmartTextMessage } from "@/utils/smartTextMessage";

// iPad request email helper
const sendIpadRequestEmail = (recruitName: string, email: string | null, phone: string | null) => {
  const subject = `iPad Request for ${recruitName}`;
  const body = `Team,\n\nI'd like to request an iPad for ${recruitName}.\n\nContact:\nEmail: ${email || 'N/A'}\nPhone: ${phone || 'N/A'}\n\nBadge ID:\nAddress to ship to:\n\nThanks!`;
  const mailtoLink = `mailto:salesassets@vivint.com?cc=Calvin.Schofield@vivint.com&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailtoLink;
};

interface BlitzEvent {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  location?: string;
}

interface NeedsAttentionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: AttentionCategory | null;
  onRecruitClick: (recruit: Recruit) => void;
  blitzes?: BlitzEvent[];
  repDataMap?: Map<string, any>;
  currentUserNotionId?: string | null;
  currentUserName?: string | null;
}

// Strip emojis from name
const stripEmojis = (text: string | null): string | null => {
  if (!text) return null;
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
};

const URGENCY_STYLES = {
  high: 'border-l-red-500',
  medium: 'border-l-amber-500',
  low: 'border-l-green-500',
};

const ONBOARDING_PHASES = [
  { value: 'Phase 1 ✅', label: 'Phase 1', description: 'Onboard & Get Ready' },
  { value: 'Phase 2 ✅', label: 'Phase 2', description: 'Start Training' },
  { value: 'Phase 3 ✅', label: 'Phase 3', description: 'Practice' },
  { value: 'Phase 4 ✅', label: 'Phase 4', description: 'Saddle Up' },
];

// Phase tasks for confirmation drawers
const PHASE_TASKS = {
  'Phase 1': [
    'Watched: What is a blitz and how do you get paid?',
    'Scheduled a Goals & Gameplan call with leaders',
    'Added Vivint calendar and committed to first blitz',
  ],
  'Phase 2': [
    'Learned Product basics',
    'Passed the Product Quiz',
    'Studied Upgrades 101',
    'Studied the Takeover Door Approach',
    'Sent pitch video to leaders',
  ],
  'Phase 3': [
    'Got iPad ready with Tools to Sell guide',
    'Wrote and shared "Why am I going on the blitz?"',
    'Completed 1-on-1 pitch practice with a vet',
  ],
  'Phase 4': [
    'Reviewed Packing List for Blitz Trips',
    'Watched: How to Dominate Your First Blitz',
    'Received iPad, badge, and knocking jerseys',
    'Shared "When It Gets Tough - Your Playbook" with leaders',
  ],
};

// Phase update confirmation drawer with task checklist
const PhaseConfirmationDrawer = ({
  open,
  onOpenChange,
  recruitName,
  currentPhase,
  targetPhase,
  onConfirm,
  isLoading
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruitName: string;
  currentPhase: string | null;
  targetPhase: typeof ONBOARDING_PHASES[0] | null;
  onConfirm: () => void;
  isLoading: boolean;
}) => {
  const phaseKey = targetPhase?.label as keyof typeof PHASE_TASKS;
  const tasks = phaseKey ? PHASE_TASKS[phaseKey] : [];
  
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="border-b">
          <DrawerTitle>Mark {targetPhase?.label} ✅ as Complete?</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Confirm that <span className="font-medium text-foreground">{recruitName}</span> has 
            completed all items for <span className="font-medium text-foreground">{targetPhase?.label}: {targetPhase?.description}</span>
          </p>
          
          {tasks.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4 border space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Checklist Overview
              </p>
              {tasks.map((task, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <Circle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-foreground">{task}</span>
                </div>
              ))}
            </div>
          )}
          
          {currentPhase && (
            <p className="text-xs text-muted-foreground">
              Current status: {currentPhase}
            </p>
          )}
        </div>
        <DrawerFooter className="border-t">
          <Button 
            onClick={onConfirm} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              'Confirm Complete'
            )}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="w-full"
          >
            Cancel
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

// Onboarding step confirmation drawer (for completing steps)
const OnboardingStepConfirmationDrawer = ({
  open,
  onOpenChange,
  recruitName,
  stepLabel,
  stepDescription,
  onConfirm,
  isLoading,
  isUndo = false
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruitName: string;
  stepLabel: string;
  stepDescription: string;
  onConfirm: () => void;
  isLoading: boolean;
  isUndo?: boolean;
}) => {
  const stepDetails: Record<string, string[]> = {
    'Onboarding': [
      'Signed rep agreement',
      'Completed I-9 form',
      'Background check submitted',
    ],
    'Trainings': [
      'Completed all required training modules',
      'Passed required quizzes',
    ],
    'Slack': [
      'Joined the Kaizen Slack workspace',
      'Introduced themselves in the channel',
    ],
  };
  
  const tasks = stepDetails[stepLabel] || [];
  
  // For undo, explain what will happen
  const undoConsequences: Record<string, string> = {
    'Onboarding': 'This will also reset Trainings and Slack status.',
    'Trainings': 'This will also reset Slack status.',
    'Slack': '',
  };
  
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="border-b">
          <DrawerTitle>
            {isUndo ? `Undo ${stepLabel} Completion?` : `Mark ${stepLabel} as Complete?`}
          </DrawerTitle>
        </DrawerHeader>
        <div className="p-4 space-y-4">
          {isUndo ? (
            <>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to undo <span className="font-medium text-foreground">{stepLabel}</span> for{' '}
                <span className="font-medium text-foreground">{recruitName}</span>?
              </p>
              {undoConsequences[stepLabel] && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    ⚠️ {undoConsequences[stepLabel]}
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Confirm that <span className="font-medium text-foreground">{recruitName}</span> has 
                completed <span className="font-medium text-foreground">{stepLabel}</span>
              </p>
              
              {tasks.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-4 border space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Verify Completed
                  </p>
                  {tasks.map((task, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Circle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-foreground">{task}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <DrawerFooter className="border-t">
          <Button 
            onClick={onConfirm} 
            disabled={isLoading}
            variant={isUndo ? "destructive" : "default"}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : isUndo ? (
              'Undo Step'
            ) : (
              'Confirm Complete'
            )}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="w-full"
          >
            Cancel
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

// Onboarding status values progression
const ONBOARDING_STATUS_ORDER = [
  'Not started',
  'Onboarding ✅',
  'Required Trainings ✅',
  'Slack ✅',
];

// Training progress item component (Onboarding - toggle items to mark complete)
const TrainingProgressItem = ({ 
  item,
  onRecruitClick,
  onOpenChange
}: { 
  item: AttentionRecruit;
  onRecruitClick: (recruit: Recruit) => void;
  onOpenChange: (open: boolean) => void;
}) => {
  const updateStatusMutation = useUpdateRookieStatus();
  const queryClient = useQueryClient();
  const [localProgress, setLocalProgress] = useState<typeof item.trainingProgress | null>(null);
  const [confirmDrawerOpen, setConfirmDrawerOpen] = useState(false);
  const [pendingStep, setPendingStep] = useState<{ field: string; label: string; notionStatus: string; isUndo: boolean } | null>(null);

  // Use local state for optimistic UI, fall back to prop
  const progress = localProgress ?? item.trainingProgress;
  if (!progress) return null;

  const handleToggle = async (field: string, currentValue: boolean) => {
    const newValue = !currentValue;
    
    // For iPad, use the ipadAssigned field - no confirmation needed
    if (field === 'ipadAssigned') {
      // Optimistic update
      setLocalProgress({
        ...progress,
        ipadAssigned: newValue,
      });
      
      try {
        await updateStatusMutation.mutateAsync({
          rookieId: item.recruit.id,
          ipadAssigned: newValue,
        });
        toast.success(`iPad ${newValue ? 'assigned' : 'unassigned'}`);
      } catch (error) {
        // Revert on error
        setLocalProgress({
          ...progress,
          ipadAssigned: currentValue,
        });
      }
      return;
    }
    
    // For onboarding steps, open confirmation drawer
    // The steps follow this progression:
    // Not Started -> Onboarding ✅ -> Required Trainings ✅ -> Slack ✅
    
    // COMPLETING a step (forward progression)
    if (field === 'onboardingComplete' && !progress.onboardingComplete && newValue) {
      setPendingStep({ field, label: 'Onboarding', notionStatus: 'Onboarding ✅', isUndo: false });
      setConfirmDrawerOpen(true);
    } else if (field === 'trainingsComplete' && progress.onboardingComplete && !progress.trainingsComplete && newValue) {
      setPendingStep({ field, label: 'Trainings', notionStatus: 'Required Trainings ✅', isUndo: false });
      setConfirmDrawerOpen(true);
    } else if (field === 'slackJoined' && progress.onboardingComplete && progress.trainingsComplete && !progress.slackJoined && newValue) {
      setPendingStep({ field, label: 'Slack', notionStatus: 'Slack ✅', isUndo: false });
      setConfirmDrawerOpen(true);
    }
    // UNDOING a step (backward progression) - only allow undoing the most recent step
    else if (field === 'slackJoined' && progress.slackJoined && !newValue) {
      // Undo Slack - revert to Required Trainings ✅
      setPendingStep({ field, label: 'Slack', notionStatus: 'Required Trainings ✅', isUndo: true });
      setConfirmDrawerOpen(true);
    } else if (field === 'trainingsComplete' && progress.trainingsComplete && !progress.slackJoined && !newValue) {
      // Undo Trainings (only if Slack not done) - revert to Onboarding ✅
      setPendingStep({ field, label: 'Trainings', notionStatus: 'Onboarding ✅', isUndo: true });
      setConfirmDrawerOpen(true);
    } else if (field === 'onboardingComplete' && progress.onboardingComplete && !progress.trainingsComplete && !newValue) {
      // Undo Onboarding (only if Trainings not done) - revert to Not started
      setPendingStep({ field, label: 'Onboarding', notionStatus: 'Not started', isUndo: true });
      setConfirmDrawerOpen(true);
    } else if (currentValue && !newValue) {
      // Trying to undo a step that has dependent steps completed
      toast.error("Undo later steps first");
    } else {
      toast.error("Steps must be completed in order");
    }
  };

  const handleConfirmStep = async () => {
    if (!pendingStep) return;
    
    const newProgressState = { ...progress };
    
    if (pendingStep.isUndo) {
      // Undoing - reset the step and all dependent steps
      if (pendingStep.field === 'onboardingComplete') {
        newProgressState.onboardingComplete = false;
        newProgressState.trainingsComplete = false;
        newProgressState.slackJoined = false;
      } else if (pendingStep.field === 'trainingsComplete') {
        newProgressState.trainingsComplete = false;
        newProgressState.slackJoined = false;
      } else if (pendingStep.field === 'slackJoined') {
        newProgressState.slackJoined = false;
      }
    } else {
      // Completing
      if (pendingStep.field === 'onboardingComplete') {
        newProgressState.onboardingComplete = true;
      } else if (pendingStep.field === 'trainingsComplete') {
        newProgressState.trainingsComplete = true;
      } else if (pendingStep.field === 'slackJoined') {
        newProgressState.slackJoined = true;
      }
    }
    
    // Optimistic update
    setLocalProgress(newProgressState);
    setConfirmDrawerOpen(false);
    
    try {
      await updateStatusMutation.mutateAsync({
        rookieId: item.recruit.id,
        onboardingStatus: pendingStep.notionStatus,
      });
      toast.success(pendingStep.isUndo ? `Reverted to ${pendingStep.notionStatus}` : `Marked as ${pendingStep.notionStatus}`);
      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
    } catch (error) {
      // Revert on error
      setLocalProgress(progress);
      toast.error("Failed to update status");
    }
    
    setPendingStep(null);
  };

  // Determine which items are editable based on progression
  // Forward: can edit the next uncompleted step
  // Backward: can undo the most recently completed step
  const canEditOnboarding = !progress.onboardingComplete || (progress.onboardingComplete && !progress.trainingsComplete);
  const canEditTrainings = (progress.onboardingComplete && !progress.trainingsComplete) || (progress.trainingsComplete && !progress.slackJoined);
  const canEditSlack = (progress.onboardingComplete && progress.trainingsComplete && !progress.slackJoined) || progress.slackJoined;
  
  const progressItems = [
    { 
      key: 'onboardingComplete', 
      label: 'Onboarding', 
      value: progress.onboardingComplete,
      icon: GraduationCap,
      editable: canEditOnboarding
    },
    { 
      key: 'trainingsComplete', 
      label: 'Trainings', 
      value: progress.trainingsComplete,
      icon: BookOpen,
      editable: canEditTrainings
    },
    { 
      key: 'slackJoined', 
      label: 'Slack', 
      value: progress.slackJoined,
      icon: MessageCircle,
      editable: canEditSlack
    },
    { 
      key: 'ipadAssigned', 
      label: 'iPad', 
      value: progress.ipadAssigned,
      icon: Tablet,
      editable: true // iPad can always be toggled
    },
  ];

  // Determine what step they're currently on for display
  let currentStepLabel = 'Not started';
  if (progress.slackJoined) {
    currentStepLabel = 'Slack ✅';
  } else if (progress.trainingsComplete) {
    currentStepLabel = 'Required Trainings ✅';
  } else if (progress.onboardingComplete) {
    currentStepLabel = 'Onboarding ✅';
  }

  return (
    <>
      <div
        className={cn(
          "bg-card rounded-lg p-4 border border-l-4 shadow-sm",
          URGENCY_STYLES[item.urgency]
        )}
      >
        {/* Header - clickable to open detail */}
        <div 
          className="flex items-start justify-between gap-3 cursor-pointer"
          onClick={() => {
            onRecruitClick(item.recruit);
            onOpenChange(false);
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-medium">
                {stripEmojis(item.recruit.name)}
              </span>
              <Badge variant="outline" className="text-xs">
                {item.recruit.stage}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {currentStepLabel}
            </p>
            {item.daysUntilBlitz !== undefined && item.daysUntilBlitz >= 0 && (
              <Badge variant="secondary" className="mt-1 text-xs">
                {item.daysUntilBlitz === 0 ? 'Blitz today' : 
                 item.daysUntilBlitz === 1 ? 'Blitz tomorrow' : 
                 `Blitz in ${item.daysUntilBlitz}d`}
              </Badge>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
        </div>

        {/* Progress checklist - simple clickable chips (no toggle switches) */}
        <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-2">
          {progressItems.map(({ key, label, value, icon: Icon, editable }) => (
            <button 
              key={key}
              type="button"
              disabled={!editable || updateStatusMutation.isPending}
              onClick={(e) => {
                e.stopPropagation();
                if (editable) {
                  handleToggle(key, value);
                }
              }}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg transition-colors text-left",
                value ? "bg-green-500/10" : "bg-muted/50",
                editable && !updateStatusMutation.isPending && "cursor-pointer hover:ring-2 hover:ring-primary/30 active:scale-[0.98]",
                !editable && "opacity-60 cursor-not-allowed"
              )}
            >
              {updateStatusMutation.isPending && pendingStep?.field === key ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : value ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={cn(
                "text-sm",
                value ? "text-green-600" : "text-muted-foreground"
              )}>
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* iPad Request Button - show when iPad not assigned */}
        {!progress.ipadAssigned && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Tablet className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Need to request an iPad?</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full border-amber-500/50 hover:bg-amber-500/10"
                onClick={() => sendIpadRequestEmail(
                  stripEmojis(item.recruit.name) || item.recruit.name,
                  item.recruit.email,
                  item.recruit.phone
                )}
              >
                <Mail className="h-4 w-4 mr-2" />
                Request iPad via Email
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* Onboarding Step Confirmation Drawer */}
      <OnboardingStepConfirmationDrawer
        open={confirmDrawerOpen}
        onOpenChange={(open) => {
          setConfirmDrawerOpen(open);
          if (!open) setPendingStep(null);
        }}
        recruitName={stripEmojis(item.recruit.name) || item.recruit.name}
        stepLabel={pendingStep?.label || ''}
        stepDescription={pendingStep?.notionStatus || ''}
        onConfirm={handleConfirmStep}
        isLoading={updateStatusMutation.isPending}
        isUndo={pendingStep?.isUndo || false}
      />
    </>
  );
};

// Blitz recruit item with commit/uncommit functionality
const BlitzRecruitItem = ({
  item,
  onRecruitClick,
  onOpenChange,
  onCall,
  onText,
  blitzes,
  repDataMap
}: {
  item: AttentionRecruit;
  onRecruitClick: (recruit: Recruit) => void;
  onOpenChange: (open: boolean) => void;
  onCall: (recruit: Recruit, e: React.MouseEvent) => void;
  onText: (recruit: Recruit, e: React.MouseEvent) => void;
  blitzes: BlitzEvent[];
  repDataMap?: Map<string, any>;
}) => {
  const [blitzDrawerOpen, setBlitzDrawerOpen] = useState(false);
  
  const repData = repDataMap?.get(item.recruit.id);
  // Extract just IDs from committed_blitzes (may be strings or objects with id property)
  const rawCommitments = repData?.committed_blitzes || [];
  const currentCommitments: string[] = Array.isArray(rawCommitments)
    ? rawCommitments.map((b: string | { id: string }) => typeof b === 'string' ? b : b.id)
    : [];
  
  // Calculate how many are future blitzes
  const futureBlitzIds = new Set(blitzes.map(b => b.id));
  const futureCommitmentCount = currentCommitments.filter(id => futureBlitzIds.has(id)).length;

  return (
    <>
      <div
        className={cn(
          "bg-card rounded-lg p-4 border border-l-4 shadow-sm",
          URGENCY_STYLES[item.urgency]
        )}
      >
        {/* Header - clickable to open detail */}
        <div 
          className="flex items-start justify-between gap-3 cursor-pointer"
          onClick={() => {
            onRecruitClick(item.recruit);
            onOpenChange(false);
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-medium">
                {stripEmojis(item.recruit.name)}
              </span>
              <Badge variant="outline" className="text-xs">
                {item.recruit.stage}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {item.reason}
            </p>
            {item.recruit.teamName && (
              <p className="text-xs text-muted-foreground mt-1">
                {item.recruit.teamName}
              </p>
            )}
          </div>
          
          <div className="flex gap-1 flex-shrink-0">
            {item.recruit.phone && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={(e) => onCall(item.recruit, e)}
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={(e) => onText(item.recruit, e)}
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground mt-2.5" />
          </div>
        </div>

        {/* Blitz commitment section */}
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {item.pastBlitzCount && item.pastBlitzCount > 0
                  ? `${item.pastBlitzCount} blitz${item.pastBlitzCount > 1 ? 'es' : ''} already attended`
                  : futureCommitmentCount === 0 
                    ? 'No blitzes committed' 
                    : `${futureCommitmentCount} blitz${futureCommitmentCount > 1 ? 'es' : ''} committed`
                }
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setBlitzDrawerOpen(true);
              }}
            >
              {futureCommitmentCount === 0 && !item.pastBlitzCount ? 'Commit to Blitz' : 'Manage'}
            </Button>
          </div>
        </div>
      </div>

      <BlitzCommitmentDrawer
        open={blitzDrawerOpen}
        onOpenChange={setBlitzDrawerOpen}
        recruitName={stripEmojis(item.recruit.name) || item.recruit.name}
        recruitId={item.recruit.id}
        currentCommitments={currentCommitments}
        availableBlitzes={blitzes}
      />
    </>
  );
};

// Blitz Prep Progress Item - shows ramp phases with toggles for recruits who graduated from onboarding
const BlitzPrepProgressItem = ({
  item,
  onRecruitClick,
  onOpenChange,
  blitzes,
  repDataMap
}: {
  item: AttentionRecruit;
  onRecruitClick: (recruit: Recruit) => void;
  onOpenChange: (open: boolean) => void;
  blitzes: BlitzEvent[];
  repDataMap?: Map<string, any>;
}) => {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [confirmDrawerOpen, setConfirmDrawerOpen] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<number | null>(null);
  const [blitzDrawerOpen, setBlitzDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'verify' | 'undo'>('verify');

  const rampProgress = item.rampPhaseProgress;
  if (!rampProgress) return null;

  // Get blitz commitment data
  const repData = repDataMap?.get(item.recruit.id);
  const rawCommitments = repData?.committed_blitzes || [];
  const currentCommitments: string[] = Array.isArray(rawCommitments)
    ? rawCommitments.map((b: string | { id: string }) => typeof b === 'string' ? b : b.id)
    : [];
  
  // Calculate how many are future blitzes
  const futureBlitzIds = new Set(blitzes.map(b => b.id));
  const futureCommitmentCount = currentCommitments.filter(id => futureBlitzIds.has(id)).length;
  const hasBlitzCommitted = futureCommitmentCount > 0;

  const handlePhaseClick = (phaseNum: number, isComplete: boolean) => {
    setSelectedPhase(phaseNum);
    setHasError(false);
    setDrawerMode(isComplete ? 'undo' : 'verify');
    setConfirmDrawerOpen(true);
  };

  const handlePhaseConfirm = async () => {
    if (!selectedPhase) return;
    
    setIsSubmitting(true);
    setHasError(false);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const phaseParams: Record<string, boolean | string> = {};
      phaseParams[`rampPhase${selectedPhase}Complete`] = true;

      const { error } = await supabase.functions.invoke('update-rookie-status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          rookieId: item.recruit.id,
          ...phaseParams
        }
      });

      if (error) throw error;

      toast.success(`Phase ${selectedPhase} verified!`);
      setConfirmDrawerOpen(false);
      setSelectedPhase(null);
      setHasError(false);
      
      // Invalidate all relevant queries to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      queryClient.invalidateQueries({ queryKey: ['recruit-rep-data', item.recruit.id] });
      queryClient.invalidateQueries({ queryKey: ['recruits-rep-data'] });
    } catch (error: any) {
      console.error('Error confirming phase:', error);
      setHasError(true);
      toast.error('Failed to save. Please try again.');
      // Don't close the drawer so user can retry
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhaseUndo = async () => {
    if (!selectedPhase) return;
    
    setIsSubmitting(true);
    setHasError(false);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Undo this phase and all phases after it
      const phaseParams: Record<string, boolean | string> = {};
      for (let i = selectedPhase; i <= 4; i++) {
        phaseParams[`rampPhase${i}Complete`] = false;
      }

      const { error } = await supabase.functions.invoke('update-rookie-status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          rookieId: item.recruit.id,
          ...phaseParams
        }
      });

      if (error) throw error;

      toast.success(`Phase ${selectedPhase} undone`);
      setConfirmDrawerOpen(false);
      setSelectedPhase(null);
      setHasError(false);
      
      // Invalidate all relevant queries to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      queryClient.invalidateQueries({ queryKey: ['recruit-rep-data', item.recruit.id] });
      queryClient.invalidateQueries({ queryKey: ['recruits-rep-data'] });
    } catch (error: any) {
      console.error('Error undoing phase:', error);
      setHasError(true);
      toast.error('Failed to undo. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const phases = [
    { num: 1, label: 'Phase 1', description: 'Onboard & Get Ready', complete: rampProgress.phase1Complete },
    { num: 2, label: 'Phase 2', description: 'Start Training', complete: rampProgress.phase2Complete },
    { num: 3, label: 'Phase 3', description: 'Practice', complete: rampProgress.phase3Complete },
    { num: 4, label: 'Phase 4', description: 'Saddle Up', complete: rampProgress.phase4Complete },
  ];

  return (
    <>
      <div
        className={cn(
          "bg-card rounded-lg p-4 border border-l-4 shadow-sm",
          URGENCY_STYLES[item.urgency]
        )}
      >
        {/* Header - clickable to open detail */}
        <div 
          className="flex items-start justify-between gap-3 cursor-pointer"
          onClick={() => {
            onRecruitClick(item.recruit);
            onOpenChange(false);
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-medium">
                {stripEmojis(item.recruit.name)}
              </span>
              <Badge variant="outline" className="text-xs">
                {item.recruit.stage}
              </Badge>
            </div>
            {/* Blitz commitment indicator - only show if has blitz with proximity */}
            {hasBlitzCommitted && item.blitzName && item.daysUntilBlitz !== undefined && item.daysUntilBlitz >= 0 && (
              <Badge 
                variant={item.daysUntilBlitz <= 7 ? "destructive" : item.daysUntilBlitz <= 14 ? "default" : "secondary"}
                className="text-xs"
              >
                <Plane className="w-3 h-3 mr-1" />
                {item.daysUntilBlitz === 0 ? `${item.blitzName} today` : `${item.blitzName} in ${item.daysUntilBlitz}d`}
              </Badge>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
        </div>

        {/* iPad needed indicator */}
        {item.trainingProgress && !item.trainingProgress.ipadAssigned && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-md">
              <Tablet className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                Needs iPad to start ramp
              </span>
            </div>
          </div>
        )}

        {/* Blitz commitment section */}
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plane className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {futureCommitmentCount === 0 
                  ? 'No blitzes committed' 
                  : `${futureCommitmentCount} blitz${futureCommitmentCount > 1 ? 'es' : ''} committed`
                }
              </span>
            </div>
            <Button
              variant={hasBlitzCommitted ? "outline" : "default"}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setBlitzDrawerOpen(true);
              }}
            >
              {hasBlitzCommitted ? 'Manage' : 'Commit to Blitz'}
            </Button>
          </div>
        </div>

        {/* Ramp Phase Progress */}
        <div className="mt-3 pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-3">Ramp to Blitz Progress:</p>
          <div className="grid grid-cols-2 gap-2">
            {phases.map((phase) => (
              <Button
                key={phase.num}
                variant={phase.complete ? "secondary" : "outline"}
                size="sm"
                className={cn(
                  "justify-start text-xs h-auto py-2 px-3",
                  phase.complete && "bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500/20",
                  !phase.complete && "hover:bg-primary/10"
                )}
                onClick={() => handlePhaseClick(phase.num, phase.complete)}
                disabled={isSubmitting}
              >
                {phase.complete ? (
                  <CheckCircle2 className="h-3 w-3 mr-2" />
                ) : (
                  <Circle className="h-3 w-3 mr-2" />
                )}
                <div className="text-left">
                  <div className="font-medium">{phase.label}</div>
                  <div className="text-[10px] opacity-70">{phase.description}</div>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Progress summary */}
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {4 - (rampProgress.incompletePhases?.length || 0)}/4 phases complete
            </span>
          </div>
        </div>
      </div>

      {/* Use the thorough PhaseVerificationDrawer - supports both verify and undo modes */}
      <PhaseVerificationDrawer
        open={confirmDrawerOpen}
        onOpenChange={(open) => {
          setConfirmDrawerOpen(open);
          if (!open) {
            setSelectedPhase(null);
            setHasError(false);
          }
        }}
        recruitName={stripEmojis(item.recruit.name) || item.recruit.name}
        phase={selectedPhase || 1}
        isSubmitting={isSubmitting}
        hasError={hasError}
        onConfirm={handlePhaseConfirm}
        mode={drawerMode}
        onUndo={handlePhaseUndo}
        watchedVideos={(repData?.watched_videos as string[]) || []}
        goalsSetupComplete={false}
        hasCommittedBlitz={
          Array.isArray(repData?.committed_blitzes) &&
          (repData.committed_blitzes as unknown[]).length > 0
        }
      />

      <BlitzCommitmentDrawer
        open={blitzDrawerOpen}
        onOpenChange={setBlitzDrawerOpen}
        recruitName={stripEmojis(item.recruit.name) || item.recruit.name}
        recruitId={item.recruit.id}
        currentCommitments={currentCommitments}
        availableBlitzes={blitzes}
      />
    </>
  );
};

// Default recruit item component
const DefaultRecruitItem = ({
  item,
  onRecruitClick,
  onOpenChange,
  onCall,
  onText
}: {
  item: AttentionRecruit;
  onRecruitClick: (recruit: Recruit) => void;
  onOpenChange: (open: boolean) => void;
  onCall: (recruit: Recruit, e: React.MouseEvent) => void;
  onText: (recruit: Recruit, e: React.MouseEvent) => void;
}) => (
  <div
    className={cn(
      "bg-card rounded-lg p-4 border border-l-4 shadow-sm cursor-pointer hover:shadow-md transition-all",
      URGENCY_STYLES[item.urgency]
    )}
    onClick={() => {
      onRecruitClick(item.recruit);
      onOpenChange(false);
    }}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-medium">
            {stripEmojis(item.recruit.name)}
          </span>
          <Badge variant="outline" className="text-xs">
            {item.recruit.stage}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {item.reason}
        </p>
        {item.recruit.teamName && (
          <p className="text-xs text-muted-foreground mt-1">
            {item.recruit.teamName}
          </p>
        )}
      </div>
      
      <div className="flex gap-1 flex-shrink-0">
        {item.recruit.phone && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={(e) => onCall(item.recruit, e)}
            >
              <Phone className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={(e) => onText(item.recruit, e)}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          </>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground mt-2.5" />
      </div>
    </div>
  </div>
);

// Readiness Item Component - shows rookie's preseason progress and blitz commitments
const ReadinessItem = ({
  item,
  onRecruitClick,
  onOpenChange,
  blitzes,
  repDataMap,
  currentUserNotionId,
  currentUserName,
}: {
  item: AttentionRecruit;
  onRecruitClick: (recruit: Recruit) => void;
  onOpenChange: (open: boolean) => void;
  blitzes: BlitzEvent[];
  repDataMap?: Map<string, any>;
  currentUserNotionId?: string | null;
  currentUserName?: string | null;
}) => {
  const [blitzDrawerOpen, setBlitzDrawerOpen] = useState(false);
  
  const repData = repDataMap?.get(item.recruit.id);
  const rawCommitments = repData?.committed_blitzes || [];
  const currentCommitments: string[] = Array.isArray(rawCommitments)
    ? rawCommitments.map((b: string | { id: string }) => typeof b === 'string' ? b : b.id)
    : [];

  const readiness = item.readinessProgress;
  const blitzInfo = item.blitzCommitments;
  const missingGoals = readiness?.missingGoals || [];
  
  const getProgressStatus = (goal: number, progress: number) => {
    if (goal === 0) return 'no-goal';
    const pct = (progress / goal) * 100;
    if (pct >= 100) return 'complete';
    if (pct >= 70) return 'on-track';
    return 'behind';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'text-green-600';
      case 'on-track': return 'text-green-500';
      case 'behind': return 'text-amber-500';
      case 'no-goal': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const trainingStatus = getProgressStatus(readiness?.trainingHoursGoal || 0, readiness?.trainingHoursProgress || 0);
  const booksStatus = getProgressStatus(readiness?.booksGoal || 0, readiness?.booksProgress || 0);
  const rolePlaysStatus = getProgressStatus(readiness?.rolePlaysGoal || 0, readiness?.rolePlaysProgress || 0);
  const mnlStatus = getProgressStatus(readiness?.mnlGoal || 0, readiness?.mnlProgress || 0);

  // Helper to format training minutes as hours
  const formatTrainingHours = (minutes: number) => {
    const hours = minutes / 60;
    if (hours === 0) return '0 hrs';
    if (hours < 1) return `${Math.round(minutes)} min`;
    return `${hours % 1 === 0 ? hours : hours.toFixed(1)} hrs`;
  };

  // Determine relationship to recruit
  const isRecruiter = currentUserNotionId && item.recruit.recruiterUserId === currentUserNotionId;
  const isTeamLeader = currentUserNotionId && repData?.team_leader === currentUserNotionId;

  const handleText = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.recruit.phone) {
      // Generate smart prefilled message
      const message = generateSmartTextMessage({
        recruitName: stripEmojis(item.recruit.name) || item.recruit.name,
        readinessProgress: readiness || undefined,
        isRecruiter: !!isRecruiter,
        isTeamLeader: !!isTeamLeader,
        currentUserName: currentUserName || undefined,
      });
      
      // Encode the message for SMS
      const encodedMessage = encodeURIComponent(message);
      window.location.href = `sms:${item.recruit.phone}?body=${encodedMessage}`;
    }
  };

  return (
    <>
      <div className={cn(
        "bg-card rounded-lg p-4 border border-l-4 shadow-sm",
        URGENCY_STYLES[item.urgency]
      )}>
        {/* Header */}
        <div 
          className="flex items-start justify-between gap-3 cursor-pointer"
          onClick={() => {
            onRecruitClick(item.recruit);
            onOpenChange(false);
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-medium">{stripEmojis(item.recruit.name)}</span>
              <Badge variant="outline" className="text-xs">{item.recruit.stage}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{item.reason}</p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {item.recruit.phone && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleText}>
                <MessageSquare className="h-4 w-4" />
              </Button>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground mt-2" />
          </div>
        </div>

        {/* FP+ Progress (if they have a goal) */}
        {readiness && (readiness.fpGoal > 0 || readiness.fpCurrent > 0) && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center justify-between bg-primary/10 rounded-lg p-3">
              <span className="text-sm font-medium">FP+</span>
              <span className="text-sm font-bold text-primary">
                {readiness.fpCurrent.toFixed(1)} / {readiness.fpGoal.toFixed(1)}
              </span>
            </div>
          </div>
        )}

        {/* Progress Grid */}
        {readiness && (
          <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-2">
            {/* Training */}
            <div className={cn(
              "flex items-center gap-2 p-2 rounded-lg",
              trainingStatus === 'no-goal' ? 'bg-red-500/10' : 'bg-muted/30'
            )}>
              <Clock className={cn("h-4 w-4", getStatusColor(trainingStatus))} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Training</span>
                  <span className={cn("font-medium", getStatusColor(trainingStatus))}>
                    {trainingStatus === 'no-goal' ? 'No goal' : `${formatTrainingHours(readiness.trainingHoursProgress)}/${formatTrainingHours(readiness.trainingHoursGoal)}`}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Books */}
            <div className={cn(
              "flex items-center gap-2 p-2 rounded-lg",
              booksStatus === 'no-goal' ? 'bg-red-500/10' : 'bg-muted/30'
            )}>
              <BookOpen className={cn("h-4 w-4", getStatusColor(booksStatus))} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Books</span>
                  <span className={cn("font-medium", getStatusColor(booksStatus))}>
                    {booksStatus === 'no-goal' ? 'No goal' : `${readiness.booksProgress}/${readiness.booksGoal}`}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Role Plays */}
            <div className={cn(
              "flex items-center gap-2 p-2 rounded-lg",
              rolePlaysStatus === 'no-goal' ? 'bg-red-500/10' : 'bg-muted/30'
            )}>
              <Theater className={cn("h-4 w-4", getStatusColor(rolePlaysStatus))} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Role Plays</span>
                  <span className={cn("font-medium", getStatusColor(rolePlaysStatus))}>
                    {rolePlaysStatus === 'no-goal' ? 'No goal' : `${readiness.rolePlaysProgress}/${readiness.rolePlaysGoal}`}
                  </span>
                </div>
              </div>
            </div>
            
            {/* MNL */}
            <div className={cn(
              "flex items-center gap-2 p-2 rounded-lg",
              mnlStatus === 'no-goal' ? 'bg-red-500/10' : 'bg-muted/30'
            )}>
              <Moon className={cn("h-4 w-4", getStatusColor(mnlStatus))} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">MNL</span>
                  <span className={cn("font-medium", getStatusColor(mnlStatus))}>
                    {mnlStatus === 'no-goal' ? 'No goal' : `${readiness.mnlProgress}/${readiness.mnlGoal}`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Blitz Commitments */}
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plane className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">
                {currentCommitments.length === 0 
                  ? 'No blitzes committed' 
                  : blitzInfo?.upcomingBlitzNames && blitzInfo.upcomingBlitzNames.length > 0
                    ? blitzInfo.upcomingBlitzNames.slice(0, 2).join(', ')
                    : `${currentCommitments.length} committed`
                }
              </span>
            </div>
            <Button
              variant={currentCommitments.length === 0 ? "default" : "outline"}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setBlitzDrawerOpen(true);
              }}
            >
              {currentCommitments.length === 0 ? 'Add Blitz' : 'Manage'}
            </Button>
          </div>
        </div>
      </div>

      <BlitzCommitmentDrawer
        open={blitzDrawerOpen}
        onOpenChange={setBlitzDrawerOpen}
        recruitName={stripEmojis(item.recruit.name) || item.recruit.name}
        recruitId={item.recruit.id}
        currentCommitments={currentCommitments}
        availableBlitzes={blitzes}
      />
    </>
  );
};

export const NeedsAttentionDrawer = ({ 
  open, 
  onOpenChange, 
  category,
  onRecruitClick,
  blitzes = [],
  repDataMap,
  currentUserNotionId,
  currentUserName,
}: NeedsAttentionDrawerProps) => {
  const [scheduleRecruit, setScheduleRecruit] = useState<Recruit | null>(null);
  const [contactRecruit, setContactRecruit] = useState<Recruit | null>(null);
  const [phoneDrawerRecruit, setPhoneDrawerRecruit] = useState<Recruit | null>(null);
  const [pendingPhoneAction, setPendingPhoneAction] = useState<'text' | 'call' | null>(null);
  
  // Post-contact drawer state for direct call/text buttons
  const [postContactOpen, setPostContactOpen] = useState(false);
  const [postContactRecruit, setPostContactRecruit] = useState<Recruit | null>(null);
  const [postContactMethod, setPostContactMethod] = useState<'call' | 'text'>('call');
  
  const queryClient = useQueryClient();

  if (!category) return null;

  const openPhoneDrawer = (recruit: Recruit, action: 'text' | 'call') => {
    setPhoneDrawerRecruit(recruit);
    setPendingPhoneAction(action);
  };

  const handleCall = (recruit: Recruit, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!recruit.phone) {
      openPhoneDrawer(recruit, 'call');
      return;
    }
    
    // Open phone app
    window.location.href = `tel:${recruit.phone}`;
    
    // Open post-contact drawer to log the call outcome
    setPostContactRecruit(recruit);
    setPostContactMethod('call');
    setPostContactOpen(true);
  };

  const handleText = (recruit: Recruit, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!recruit.phone) {
      openPhoneDrawer(recruit, 'text');
      return;
    }
    
    // Open SMS app
    window.location.href = `sms:${recruit.phone}`;
    
    // Open post-contact drawer to log the text
    setPostContactRecruit(recruit);
    setPostContactMethod('text');
    setPostContactOpen(true);
  };

  const isOnboardingCategory = category.id === 'training-progress';
  const isBlitzPrepCategory = category.id === 'blitz-prep';
  const isNoBlitzCategory = category.id === 'no-commitment';
  const isReadinessCategory = category.id === 'readiness';
  const isHotLeadsCategory = category.id === 'hot-leads';

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85dvh] flex flex-col">
          <DrawerHeader className="border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <DrawerTitle className="flex items-center gap-2">
                <span>{category.emoji}</span>
                <span>{category.label}</span>
                <Badge variant="secondary" className="ml-2">
                  {category.count}
                </Badge>
              </DrawerTitle>
            </div>
            {!isOnboardingCategory && !isBlitzPrepCategory && !isNoBlitzCategory && !isReadinessCategory && (
              <p className="text-xs text-muted-foreground mt-1">
                Swipe right to mark contacted, left to schedule
              </p>
            )}
            {isBlitzPrepCategory && (
              <p className="text-xs text-muted-foreground mt-1">
                Mark phases complete as they finish ramp-to-blitz
              </p>
            )}
            {isNoBlitzCategory && (
              <p className="text-xs text-muted-foreground mt-1">
                Swipe right to contact, left to schedule. Tap "Manage" for blitzes.
              </p>
            )}
            {isReadinessCategory && (
              <p className="text-xs text-muted-foreground mt-1">
                Rookies with their preseason progress and blitz commitments
              </p>
            )}
          </DrawerHeader>

          {/* Icon legend for swipeable items - only for categories with rookies who need ramp training */}
          {!isOnboardingCategory && !isBlitzPrepCategory && !isReadinessCategory && !isHotLeadsCategory && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground px-4 py-2 border-b bg-muted/30">
              <div className="flex items-center gap-1">
                <Tablet className="h-3 w-3 text-amber-500" />
                <span>No iPad</span>
              </div>
              <div className="flex items-center gap-1">
                <BookOpen className="h-3 w-3 text-amber-500" />
                <span>Onboarding</span>
              </div>
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3 text-amber-500" />
                <span>Ramp</span>
              </div>
            </div>
          )}
          
          <div className="flex-1 overflow-y-auto p-4 pb-8 space-y-3">
            {category.recruits.map((item) => {
              if (isOnboardingCategory) {
                return (
                  <TrainingProgressItem
                    key={item.recruit.id}
                    item={item}
                    onRecruitClick={onRecruitClick}
                    onOpenChange={onOpenChange}
                  />
                );
              }
              
              if (isBlitzPrepCategory) {
                return (
                  <BlitzPrepProgressItem
                    key={item.recruit.id}
                    item={item}
                    onRecruitClick={onRecruitClick}
                    onOpenChange={onOpenChange}
                    blitzes={blitzes || []}
                    repDataMap={repDataMap}
                  />
                );
              }

              if (isNoBlitzCategory) {
                return (
                  <div key={item.recruit.id}>
                    {item.showDivider && (
                      <div className="flex items-center gap-2 py-2 mt-2 mb-3">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground px-2">No more blitzes planned</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    )}
                    <SwipeableBlitzItem
                      item={item}
                      onRecruitClick={onRecruitClick}
                      onDrawerClose={() => onOpenChange(false)}
                      onSchedule={(recruit) => setScheduleRecruit(recruit)}
                      onContact={(recruit) => setContactRecruit(recruit)}
                      onDirectCall={(recruit) => {
                        if (recruit.phone) {
                          window.location.href = `tel:${recruit.phone}`;
                          setPostContactRecruit(recruit);
                          setPostContactMethod('call');
                          setPostContactOpen(true);
                        }
                      }}
                      onDirectText={(recruit) => {
                        if (recruit.phone) {
                          window.location.href = `sms:${recruit.phone}`;
                          setPostContactRecruit(recruit);
                          setPostContactMethod('text');
                          setPostContactOpen(true);
                        }
                      }}
                      blitzes={blitzes}
                      repDataMap={repDataMap}
                    />
                  </div>
                );
              }

              if (isReadinessCategory) {
                return (
                  <ReadinessItem
                    key={item.recruit.id}
                    item={item}
                    onRecruitClick={onRecruitClick}
                    onOpenChange={onOpenChange}
                    blitzes={blitzes}
                    repDataMap={repDataMap}
                    currentUserNotionId={currentUserNotionId}
                    currentUserName={currentUserName}
                  />
                );
              }
              
              const repDataForItem = repDataMap?.get(item.recruit.id);
              return (
                <SwipeableRecruitItem
                  key={item.recruit.id}
                  item={item}
                  onRecruitClick={onRecruitClick}
                  onDrawerClose={() => onOpenChange(false)}
                  onSchedule={(recruit) => setScheduleRecruit(recruit)}
                  onContact={(recruit) => setContactRecruit(recruit)}
                  onDirectCall={(recruit) => {
                    if (recruit.phone) {
                      window.location.href = `tel:${recruit.phone}`;
                      setPostContactRecruit(recruit);
                      setPostContactMethod('call');
                      setPostContactOpen(true);
                    }
                  }}
                  onDirectText={(recruit) => {
                    if (recruit.phone) {
                      window.location.href = `sms:${recruit.phone}`;
                      setPostContactRecruit(recruit);
                      setPostContactMethod('text');
                      setPostContactOpen(true);
                    }
                  }}
                  repData={repDataForItem}
                />
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>

      <ScheduleFollowUpDrawer
        open={!!scheduleRecruit}
        onOpenChange={(open) => !open && setScheduleRecruit(null)}
        recruit={scheduleRecruit}
      />

      <ContactMethodDrawer
        open={!!contactRecruit}
        onOpenChange={(open) => !open && setContactRecruit(null)}
        recruit={contactRecruit}
      />

      <AddPhoneDrawer
        open={!!phoneDrawerRecruit}
        onOpenChange={(open) => {
          if (!open) {
            setPhoneDrawerRecruit(null);
            setPendingPhoneAction(null);
          }
        }}
        personName={phoneDrawerRecruit?.name || ''}
        recruitId={phoneDrawerRecruit?.id || ''}
        pendingAction={pendingPhoneAction}
        onPhoneSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
        }}
      />

      {/* Post-Contact Drawer for direct call/text buttons */}
      <PostContactDrawer
        open={postContactOpen}
        onOpenChange={(open) => {
          setPostContactOpen(open);
          if (!open) setPostContactRecruit(null);
        }}
        recruit={postContactRecruit}
        contactMethod={postContactMethod}
        onComplete={() => {
          // Just close - no auto-dismiss since we're inside a drawer
          setPostContactOpen(false);
          setPostContactRecruit(null);
        }}
      />
    </>
  );
};
