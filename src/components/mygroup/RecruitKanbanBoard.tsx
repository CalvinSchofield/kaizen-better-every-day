import { useState } from "react";
import { Recruit, RecruitActivity, useUpdateRecruitStage } from "@/hooks/useGroupRecruits";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tablet, BookOpen, Target, ChevronDown, ChevronUp, Clock, Users } from "lucide-react";
import { RecruitDetailDrawer } from "./RecruitDetailDrawer";
import { differenceInDays, parseISO, isAfter, isBefore, startOfToday, isSameDay, format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
// Primary stages always shown
const PRIMARY_STAGES = [
  { key: '100 List', label: '100 List', color: 'bg-muted' },
  { key: 'Reached Out', label: 'Reached Out', color: 'bg-blue-500/20' },
  { key: 'Evaluating', label: 'Evaluating', color: 'bg-yellow-500/20' },
  { key: 'Signed', label: 'Signed', color: 'bg-green-500/20' },
  { key: 'Shadow ✅', label: 'Shadow ✅', color: 'bg-emerald-500/20' },
  { key: 'Sold 💲', label: 'Sold 💲', color: 'bg-primary/20' },
  { key: 'Sold (5+) 💰', label: 'Sold (5+) 💰', color: 'bg-amber-500/20' },
];

// Secondary stages - hidden by default
const SECONDARY_STAGES = [
  { key: 'Potential Follow Up', label: 'Follow Up', color: 'bg-purple-500/20' },
  { key: 'Not Interested', label: 'Not Interested', color: 'bg-destructive/20' },
  { key: 'Signed but Not Interested', label: 'Signed (Left)', color: 'bg-destructive/20' },
];

interface RecruitKanbanBoardProps {
  recruits: Recruit[];
  activities: RecruitActivity[];
}

export const RecruitKanbanBoard = ({ recruits, activities }: RecruitKanbanBoardProps) => {
  const [selectedRecruit, setSelectedRecruit] = useState<Recruit | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showSecondary, setShowSecondary] = useState(false);
  const updateStageMutation = useUpdateRecruitStage();

  // Fetch reps data to get blocker info (iPad, onboarding, ramp phases)
  const { data: repsData } = useQuery({
    queryKey: ['reps-blockers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('reps')
        .select('notion_page_id, ipad_assigned, onboarding_complete, ramp_phase_1_complete, ramp_phase_2_complete, ramp_phase_3_complete, ramp_phase_4_complete');
      return data || [];
    },
  });

  // Create a map for quick lookup
  const repsBlockerMap = new Map(
    repsData?.map(r => [r.notion_page_id, r]) || []
  );

  // Filter recruits for display
  // - For "Potential Follow Up", only show if follow-up date is today or past
  // - Always exclude "Not Interested" and "Signed but Not Interested" from primary view
  const getRecruitsByStage = (stage: string) => {
    return recruits.filter(r => {
      if (r.stage !== stage) return false;
      
      // For Potential Follow Up, only show if due today or overdue
      if (stage === 'Potential Follow Up') {
        if (!r.nextActionDue) return false;
        const dueDate = parseISO(r.nextActionDue);
        const today = startOfToday();
        return isBefore(dueDate, today) || dueDate.getTime() === today.getTime();
      }
      
      return true;
    });
  };

  const getActivitiesForRecruit = (recruitNotionId: string) => {
    return activities.filter(a => a.rep_notion_page_id === recruitNotionId);
  };

  // Get the most recent contact date from Supabase activities
  const getLastContactFromActivities = (recruitNotionId: string): string | null => {
    const recruitActivities = activities.filter(a => 
      a.rep_notion_page_id === recruitNotionId &&
      (a.activity_type === 'phone_call' || a.activity_type === 'in_person')
    );
    
    if (recruitActivities.length === 0) return null;
    
    const sorted = [...recruitActivities].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    return sorted[0].created_at;
  };

  // Get days since last contact
  const getDaysSinceContact = (recruit: Recruit): number | null => {
    const activityLastContact = getLastContactFromActivities(recruit.notionPageId);
    const lastContact = activityLastContact || recruit.lastContact;
    if (!lastContact) return null;
    return differenceInDays(new Date(), parseISO(lastContact));
  };

  // Get the scheduled follow-up info for display
  const getScheduledFollowUp = (recruit: Recruit) => {
    if (!recruit.nextActionDue) return null;
    
    const dueDate = parseISO(recruit.nextActionDue);
    const today = startOfToday();
    
    if (isSameDay(dueDate, today)) {
      return { date: dueDate, label: 'Today', isFuture: false, isToday: true };
    }
    
    if (isAfter(dueDate, today)) {
      return { date: dueDate, label: format(dueDate, 'MMM d'), isFuture: true, isToday: false };
    }
    
    return null;
  };

  // Get blocker icons for a recruit - only for Rookies (vets/sophomores don't need ramp-to-blitz training)
  const getBlockers = (recruit: Recruit) => {
    const blockers: { icon: 'ipad' | 'onboarding' | 'ramp'; label: string }[] = [];
    
    // Only show blocker icons for Rookies
    const isRookie = recruit.year === 'Rookie' || recruit.year === '2025' || recruit.year === '2026';
    if (!isRookie) return blockers;
    
    // Check reps table data first, fall back to Notion data
    const repData = repsBlockerMap.get(recruit.notionPageId);
    
    const ipadAssigned = repData?.ipad_assigned ?? recruit.ipadAssigned ?? false;
    const onboardingComplete = repData?.onboarding_complete ?? 
      (recruit.onboardingStatus?.toLowerCase() === 'complete');
    
    // If any ramp phase is complete, onboarding is done (can't start ramp without completing onboarding)
    const hasAnyRampProgress = repData?.ramp_phase_1_complete || 
      repData?.ramp_phase_2_complete || 
      repData?.ramp_phase_3_complete || 
      repData?.ramp_phase_4_complete;
    const effectiveOnboardingComplete = onboardingComplete || hasAnyRampProgress;
    
    // Only show blockers for Signed or later stages
    const signedStages = ['Signed', 'Shadow ✅', 'Sold 💲', 'Sold (5+) 💰'];
    const isSignedOrLater = signedStages.some(s => recruit.stage === s);
    
    if (isSignedOrLater) {
      if (!ipadAssigned) {
        blockers.push({ icon: 'ipad', label: 'No iPad' });
      }
      if (!effectiveOnboardingComplete) {
        blockers.push({ icon: 'onboarding', label: 'Onboarding' });
      }
      
      // Check ramp phases - only show if onboarding is complete
      if (effectiveOnboardingComplete && repData) {
        const rampComplete = repData.ramp_phase_1_complete && 
          repData.ramp_phase_2_complete && 
          repData.ramp_phase_3_complete && 
          repData.ramp_phase_4_complete;
        if (!rampComplete) {
          blockers.push({ icon: 'ramp', label: 'Ramp' });
        }
      }
    }
    
    return blockers;
  };

  // Get upcoming blitz countdown
  const getUpcomingBlitz = (recruit: Recruit) => {
    if (!recruit.committedBlitzes?.length) return null;
    
    const today = startOfToday();
    const upcomingBlitzes = recruit.committedBlitzes
      .filter(b => b.date) // Filter out blitzes without a date
      .map(b => ({ ...b, startDate: parseISO(b.date) }))
      .filter(b => isAfter(b.startDate, today) || isSameDay(b.startDate, today))
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    
    if (upcomingBlitzes.length === 0) return null;
    
    const nextBlitz = upcomingBlitzes[0];
    const daysUntil = differenceInDays(nextBlitz.startDate, today);
    
    return {
      name: nextBlitz.name,
      daysUntil,
      isUrgent: daysUntil <= 7,
      isWarning: daysUntil <= 14 && daysUntil > 7,
    };
  };

  const handleDragStart = (e: React.DragEvent, recruit: Recruit) => {
    e.dataTransfer.setData('recruitId', recruit.notionPageId);
    e.dataTransfer.setData('currentStage', recruit.stage);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStage: string) => {
    e.preventDefault();
    const recruitId = e.dataTransfer.getData('recruitId');
    const currentStage = e.dataTransfer.getData('currentStage');

    if (currentStage !== newStage) {
      try {
        await updateStageMutation.mutateAsync({
          recruitNotionId: recruitId,
          newStage,
        });
        toast.success(`Moved to ${newStage}`);
      } catch (error) {
        toast.error('Failed to update stage');
      }
    }
  };

  const handleRecruitClick = (recruit: Recruit) => {
    setSelectedRecruit(recruit);
    setDrawerOpen(true);
  };

  // Count recruits in secondary stages
  const secondaryCount = SECONDARY_STAGES.reduce((acc, stage) => {
    return acc + getRecruitsByStage(stage.key).length;
  }, 0);

  // When drawer closes, update selected recruit from latest data
  const handleDrawerOpenChange = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      // Update selected recruit with latest data if it exists
      if (selectedRecruit) {
        const updatedRecruit = recruits.find(r => r.notionPageId === selectedRecruit.notionPageId);
        if (updatedRecruit) {
          setSelectedRecruit(updatedRecruit);
        }
      }
    }
  };

  const renderStageColumn = (stage: { key: string; label: string; color: string }) => {
    const stageRecruits = getRecruitsByStage(stage.key);
    return (
      <div
        key={stage.key}
        className="flex-shrink-0 w-64"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, stage.key)}
      >
        <div className={`rounded-lg ${stage.color} p-2 mb-2`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{stage.label}</span>
            <Badge variant="secondary" className="text-xs">
              {stageRecruits.length}
            </Badge>
          </div>
        </div>
        <div className="space-y-2 min-h-[200px]">
          {stageRecruits.map((recruit) => (
            <Card
              key={recruit.notionPageId}
              className="cursor-pointer hover:shadow-md transition-shadow"
              draggable
              onDragStart={(e) => handleDragStart(e, recruit)}
              onClick={() => handleRecruitClick(recruit)}
            >
              <CardContent className="p-3">
                {/* Row 1: Name + Blocker icons */}
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium truncate flex-1">{recruit.name}</p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {getBlockers(recruit).map((blocker, idx) => (
                      <span key={idx} className="text-amber-500">
                        {blocker.icon === 'ipad' && <Tablet className="h-3.5 w-3.5" />}
                        {blocker.icon === 'onboarding' && <BookOpen className="h-3.5 w-3.5" />}
                        {blocker.icon === 'ramp' && <Target className="h-3.5 w-3.5" />}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Row 2: Team name */}
                {recruit.teamName && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Users className="h-3 w-3" />
                    <span className="truncate">{recruit.teamName}</span>
                  </div>
                )}

                {/* Row 3: Badges - follow-up, days since contact, blitz countdown */}
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {/* Scheduled follow-up badge */}
                  {(() => {
                    const followUp = getScheduledFollowUp(recruit);
                    if (!followUp) return null;
                    return (
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] px-1.5 py-0 ${followUp.isToday 
                          ? "bg-primary/10 text-primary border-primary/30" 
                          : "bg-blue-500/10 text-blue-600 border-blue-500/30"
                        }`}
                      >
                        <Clock className="h-2.5 w-2.5 mr-0.5" />
                        {followUp.isToday ? 'Today' : followUp.label}
                      </Badge>
                    );
                  })()}

                  {/* Days since contact */}
                  {(() => {
                    const days = getDaysSinceContact(recruit);
                    if (days === null) {
                      return (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                          No contact
                        </Badge>
                      );
                    }
                    const isStale = days >= 7;
                    return (
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] px-1.5 py-0 ${isStale ? 'text-amber-600 border-amber-500/30' : 'text-muted-foreground'}`}
                      >
                        {days}d ago
                      </Badge>
                    );
                  })()}

                  {/* Blitz countdown */}
                  {(() => {
                    const blitz = getUpcomingBlitz(recruit);
                    if (!blitz) return null;
                    return (
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] px-1.5 py-0 ${
                          blitz.isUrgent 
                            ? 'bg-red-500/10 text-red-600 border-red-500/30' 
                            : blitz.isWarning 
                              ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                              : 'bg-green-500/10 text-green-600 border-green-500/30'
                        }`}
                      >
                        🎯 {blitz.daysUntil}d
                      </Badge>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Icon legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3 px-1">
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

      <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4">
        {PRIMARY_STAGES.map(renderStageColumn)}
      </div>

      {/* Toggle for secondary stages */}
      {secondaryCount > 0 && (
        <div className="mt-2 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSecondary(!showSecondary)}
            className="text-muted-foreground"
          >
            {showSecondary ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Hide Other Stages ({secondaryCount})
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Show Other Stages ({secondaryCount})
              </>
            )}
          </Button>
        </div>
      )}

      {showSecondary && (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4">
          {SECONDARY_STAGES.map(renderStageColumn)}
        </div>
      )}

      <RecruitDetailDrawer
        recruit={selectedRecruit}
        activities={selectedRecruit ? getActivitiesForRecruit(selectedRecruit.notionPageId) : []}
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
      />
    </>
  );
};
