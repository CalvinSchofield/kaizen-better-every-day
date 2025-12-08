import { useState } from "react";
import { Phone, MessageSquare, ChevronRight, CheckCircle2, Circle, Tablet, BookOpen, MessageCircle, GraduationCap, Loader2, Mail, Calendar, Clock, Theater, Moon, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { BlitzCommitmentDrawer } from "./BlitzCommitmentDrawer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

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

// Training progress item component (Onboarding - no phase updates, just toggle items)
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

  // Use local state for optimistic UI, fall back to prop
  const progress = localProgress ?? item.trainingProgress;
  if (!progress) return null;

  const handleToggle = async (field: string, currentValue: boolean) => {
    const newValue = !currentValue;
    
    // Optimistic update
    setLocalProgress({
      ...progress,
      [field]: newValue,
    });
    
    try {
      if (field === 'ipadAssigned') {
        await updateStatusMutation.mutateAsync({
          rookieNotionPageId: item.recruit.notionPageId,
          ipadAssigned: newValue,
        });
        toast.success(`iPad ${newValue ? 'assigned' : 'unassigned'}`);
      }
    } catch (error) {
      // Revert on error
      setLocalProgress({
        ...progress,
        [field]: currentValue,
      });
    }
  };

  const progressItems = [
    { 
      key: 'onboardingComplete', 
      label: 'Onboarding', 
      value: progress.onboardingComplete,
      icon: GraduationCap,
      editable: false
    },
    { 
      key: 'trainingsComplete', 
      label: 'Trainings', 
      value: progress.trainingsComplete,
      icon: BookOpen,
      editable: false
    },
    { 
      key: 'slackJoined', 
      label: 'Slack', 
      value: progress.slackJoined,
      icon: MessageCircle,
      editable: false
    },
    { 
      key: 'ipadAssigned', 
      label: 'iPad', 
      value: progress.ipadAssigned,
      icon: Tablet,
      editable: true
    },
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
            <p className="text-sm text-muted-foreground">
              {item.onboardingStatus || 'Not started'}
            </p>
            {item.daysUntilBlitz && (
              <Badge variant="secondary" className="mt-1 text-xs">
                Blitz in {item.daysUntilBlitz}d
              </Badge>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
        </div>

        {/* Progress checklist */}
        <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-2">
          {progressItems.map(({ key, label, value, icon: Icon, editable }) => (
            <div 
              key={key}
              className={cn(
                "flex items-center justify-between p-2 rounded-lg",
                value ? "bg-green-500/10" : "bg-muted/50"
              )}
            >
              <div className="flex items-center gap-2">
                {value ? (
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
              </div>
              {editable && (
                updateStatusMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Switch
                    checked={value}
                    onCheckedChange={() => handleToggle(key, value)}
                    className="scale-75"
                  />
                )
              )}
            </div>
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
  
  const repData = repDataMap?.get(item.recruit.notionPageId);
  // Extract just IDs from committed_blitzes (may be strings or objects with id property)
  const rawCommitments = repData?.committed_blitzes || [];
  const currentCommitments: string[] = Array.isArray(rawCommitments)
    ? rawCommitments.map((b: string | { id: string }) => typeof b === 'string' ? b : b.id)
    : [];

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
                {currentCommitments.length === 0 
                  ? 'No blitzes committed' 
                  : `${currentCommitments.length} blitz${currentCommitments.length > 1 ? 'es' : ''} committed`
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
              {currentCommitments.length === 0 ? 'Commit to Blitz' : 'Manage'}
            </Button>
          </div>
        </div>
      </div>

      <BlitzCommitmentDrawer
        open={blitzDrawerOpen}
        onOpenChange={setBlitzDrawerOpen}
        recruitName={stripEmojis(item.recruit.name) || item.recruit.name}
        recruitNotionPageId={item.recruit.notionPageId}
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
  onOpenChange
}: {
  item: AttentionRecruit;
  onRecruitClick: (recruit: Recruit) => void;
  onOpenChange: (open: boolean) => void;
}) => {
  const updateStatusMutation = useUpdateRookieStatus();
  const [updatingPhase, setUpdatingPhase] = useState<string | null>(null);
  const [confirmDrawerOpen, setConfirmDrawerOpen] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<typeof ONBOARDING_PHASES[0] | null>(null);

  const rampProgress = item.rampPhaseProgress;
  if (!rampProgress) return null;

  const handlePhaseClick = (phase: typeof ONBOARDING_PHASES[0], isComplete: boolean) => {
    if (isComplete) return; // Already complete
    setSelectedPhase(phase);
    setConfirmDrawerOpen(true);
  };

  const handlePhaseConfirm = async () => {
    if (!selectedPhase) return;
    
    setUpdatingPhase(selectedPhase.label);
    try {
      // Map phase label to the correct update field
      const updateData: Record<string, boolean | string> = {
        rookieNotionPageId: item.recruit.notionPageId,
      };
      
      if (selectedPhase.label === 'Phase 1') {
        updateData.rampPhase1Complete = true;
      } else if (selectedPhase.label === 'Phase 2') {
        updateData.rampPhase2Complete = true;
      } else if (selectedPhase.label === 'Phase 3') {
        updateData.rampPhase3Complete = true;
      } else if (selectedPhase.label === 'Phase 4') {
        updateData.rampPhase4Complete = true;
      }

      await updateStatusMutation.mutateAsync(updateData as any);
      toast.success(`${selectedPhase.label} marked complete`);
      setConfirmDrawerOpen(false);
    } finally {
      setUpdatingPhase(null);
    }
  };

  const phases = [
    { ...ONBOARDING_PHASES[0], complete: rampProgress.phase1Complete },
    { ...ONBOARDING_PHASES[1], complete: rampProgress.phase2Complete },
    { ...ONBOARDING_PHASES[2], complete: rampProgress.phase3Complete },
    { ...ONBOARDING_PHASES[3], complete: rampProgress.phase4Complete },
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
            {item.blitzName && item.daysUntilBlitz !== undefined && (
              <Badge 
                variant={item.daysUntilBlitz <= 7 ? "destructive" : item.daysUntilBlitz <= 14 ? "default" : "secondary"}
                className="text-xs"
              >
                {item.blitzName} in {item.daysUntilBlitz}d
              </Badge>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
        </div>

        {/* Ramp Phase Progress */}
        <div className="mt-4 pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-3">Ramp to Blitz Progress:</p>
          <div className="grid grid-cols-2 gap-2">
            {phases.map((phase) => (
              <Button
                key={phase.value}
                variant={phase.complete ? "secondary" : "outline"}
                size="sm"
                className={cn(
                  "justify-start text-xs h-auto py-2 px-3",
                  phase.complete && "bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500/20",
                  !phase.complete && "hover:bg-primary/10"
                )}
                onClick={() => handlePhaseClick(phase, phase.complete)}
                disabled={updatingPhase === phase.label}
              >
                {updatingPhase === phase.label ? (
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                ) : phase.complete ? (
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
            <Badge variant="outline" className="text-[10px]">
              {item.reason}
            </Badge>
          </div>
        </div>
      </div>

      <PhaseConfirmationDrawer
        open={confirmDrawerOpen}
        onOpenChange={setConfirmDrawerOpen}
        recruitName={stripEmojis(item.recruit.name) || item.recruit.name}
        currentPhase={null}
        targetPhase={selectedPhase}
        onConfirm={handlePhaseConfirm}
        isLoading={!!updatingPhase}
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
  repDataMap
}: {
  item: AttentionRecruit;
  onRecruitClick: (recruit: Recruit) => void;
  onOpenChange: (open: boolean) => void;
  blitzes: BlitzEvent[];
  repDataMap?: Map<string, any>;
}) => {
  const [blitzDrawerOpen, setBlitzDrawerOpen] = useState(false);
  
  const repData = repDataMap?.get(item.recruit.notionPageId);
  const rawCommitments = repData?.committed_blitzes || [];
  const currentCommitments: string[] = Array.isArray(rawCommitments)
    ? rawCommitments.map((b: string | { id: string }) => typeof b === 'string' ? b : b.id)
    : [];

  const readiness = item.readinessProgress;
  const blitzInfo = item.blitzCommitments;
  
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
      default: return 'text-muted-foreground';
    }
  };

  const trainingStatus = getProgressStatus(readiness?.trainingHoursGoal || 0, readiness?.trainingHoursProgress || 0);
  const booksStatus = getProgressStatus(readiness?.booksGoal || 0, readiness?.booksProgress || 0);
  const rolePlaysStatus = getProgressStatus(readiness?.rolePlaysGoal || 0, readiness?.rolePlaysProgress || 0);
  const mnlStatus = getProgressStatus(readiness?.mnlGoal || 0, readiness?.mnlProgress || 0);

  const handleText = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.recruit.phone) {
      window.location.href = `sms:${item.recruit.phone}`;
    } else {
      toast.error('No phone number available');
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

        {/* Progress Grid */}
        {readiness && (
          <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-2">
            {/* Training */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <Clock className={cn("h-4 w-4", getStatusColor(trainingStatus))} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Training</span>
                  <span className={cn("font-medium", getStatusColor(trainingStatus))}>
                    {readiness.trainingHoursGoal > 0 ? `${readiness.trainingHoursProgress}/${readiness.trainingHoursGoal}` : '—'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Books */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <BookOpen className={cn("h-4 w-4", getStatusColor(booksStatus))} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Books</span>
                  <span className={cn("font-medium", getStatusColor(booksStatus))}>
                    {readiness.booksGoal > 0 ? `${readiness.booksProgress}/${readiness.booksGoal}` : '—'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Role Plays */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <Theater className={cn("h-4 w-4", getStatusColor(rolePlaysStatus))} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Role Plays</span>
                  <span className={cn("font-medium", getStatusColor(rolePlaysStatus))}>
                    {readiness.rolePlaysGoal > 0 ? `${readiness.rolePlaysProgress}/${readiness.rolePlaysGoal}` : '—'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* MNL */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <Moon className={cn("h-4 w-4", getStatusColor(mnlStatus))} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">MNL</span>
                  <span className={cn("font-medium", getStatusColor(mnlStatus))}>
                    {readiness.mnlGoal > 0 ? `${readiness.mnlProgress}/${readiness.mnlGoal}` : '—'}
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
        recruitNotionPageId={item.recruit.notionPageId}
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
  repDataMap
}: NeedsAttentionDrawerProps) => {
  const [scheduleRecruit, setScheduleRecruit] = useState<Recruit | null>(null);
  const [contactRecruit, setContactRecruit] = useState<Recruit | null>(null);
  const logActivityMutation = useLogRecruitActivity();

  if (!category) return null;

  const handleCall = async (recruit: Recruit, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      await logActivityMutation.mutateAsync({
        recruitNotionId: recruit.notionPageId,
        activityType: 'phone_call',
        notes: 'Call attempt',
        updateLastContact: true,
      });
      toast.success('Call logged');
    } catch (error) {
      console.error('Failed to log call:', error);
    }
    window.location.href = `tel:${recruit.phone}`;
  };

  const handleText = async (recruit: Recruit, e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `sms:${recruit.phone}`;
  };

  const isOnboardingCategory = category.id === 'training-progress';
  const isBlitzPrepCategory = category.id === 'blitz-prep';
  const isNoBlitzCategory = category.id === 'no-commitment';
  const isReadinessCategory = category.id === 'readiness';

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh] flex flex-col">
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
          
          <div className="flex-1 overflow-y-auto p-4 pb-8 space-y-3">
            {category.recruits.map((item) => {
              if (isOnboardingCategory) {
                return (
                  <TrainingProgressItem
                    key={item.recruit.notionPageId}
                    item={item}
                    onRecruitClick={onRecruitClick}
                    onOpenChange={onOpenChange}
                  />
                );
              }
              
              if (isBlitzPrepCategory) {
                return (
                  <BlitzPrepProgressItem
                    key={item.recruit.notionPageId}
                    item={item}
                    onRecruitClick={onRecruitClick}
                    onOpenChange={onOpenChange}
                  />
                );
              }

              if (isNoBlitzCategory) {
                return (
                  <SwipeableBlitzItem
                    key={item.recruit.notionPageId}
                    item={item}
                    onRecruitClick={onRecruitClick}
                    onDrawerClose={() => onOpenChange(false)}
                    onSchedule={(recruit) => setScheduleRecruit(recruit)}
                    onContact={(recruit) => setContactRecruit(recruit)}
                    blitzes={blitzes}
                    repDataMap={repDataMap}
                  />
                );
              }

              if (isReadinessCategory) {
                return (
                  <ReadinessItem
                    key={item.recruit.notionPageId}
                    item={item}
                    onRecruitClick={onRecruitClick}
                    onOpenChange={onOpenChange}
                    blitzes={blitzes}
                    repDataMap={repDataMap}
                  />
                );
              }
              
              return (
                <SwipeableRecruitItem
                  key={item.recruit.notionPageId}
                  item={item}
                  onRecruitClick={onRecruitClick}
                  onDrawerClose={() => onOpenChange(false)}
                  onSchedule={(recruit) => setScheduleRecruit(recruit)}
                  onContact={(recruit) => setContactRecruit(recruit)}
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
    </>
  );
};
