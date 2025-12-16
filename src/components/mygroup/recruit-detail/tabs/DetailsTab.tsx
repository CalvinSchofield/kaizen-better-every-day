import { useState, useMemo, useEffect } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { getDaysUntilBlitz, formatDaysUntilBlitz } from "@/utils/blitzDateUtils";
import { 
  Tablet,
  Plane,
  MapPin,
  Check,
  ChevronDown,
  ChevronUp,
  History,
  Calendar,
  AlertTriangle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Recruit } from "@/hooks/useGroupRecruits";
import { useBlitzes } from "@/hooks/useBlitzes";
import { RecruitRepData } from "../types";
import { STAGES, getFirstName } from "../utils";

interface DetailsTabProps {
  recruit: Recruit;
  recruitRepData: RecruitRepData | null;
  recruitYtdFP: number;
  onStageChange: (newStage: string) => void;
  stageShake: boolean;
}

// Exit stages that are always allowed and permanent exit stages that need confirmation
const EXIT_STAGES = ['Not Interested', 'Potential Follow Up', 'Signed but Not Interested'];
const PERMANENT_EXIT_STAGES = ['Not Interested', 'Signed but Not Interested'];

// Separate stages into progression and exit for display purposes
const PROGRESSION_STAGES = STAGES.filter(s => !EXIT_STAGES.includes(s));
const EXIT_STAGE_OPTIONS = STAGES.filter(s => EXIT_STAGES.includes(s));

export const DetailsTab = ({
  recruit,
  recruitRepData,
  recruitYtdFP,
  onStageChange,
  stageShake
}: DetailsTabProps) => {
  const queryClient = useQueryClient();
  const recruitFirstName = getFirstName(recruit.name);
  const isRookie = recruitRepData && (recruitRepData.year === 'Rookie' || !recruitRepData.year);
  const hasCompletedOnboarding = recruitRepData?.onboarding_complete === true;
  const stageLocked = isRookie && !hasCompletedOnboarding;
  
  // Check if recruit is in an early stage (not yet signed)
  const stageLower = (recruit.stage || '').toLowerCase();
  const earlyStages = ['100_list', '100 list', 'evaluating', 'reached_out', 'reached out'];
  const isEarlyStage = earlyStages.some(s => stageLower.includes(s));
  
  const [pendingExitStage, setPendingExitStage] = useState<string | null>(null);
  
  const handleStageSelect = (newStage: string) => {
    // If it's a permanent exit stage, show confirmation dialog
    if (PERMANENT_EXIT_STAGES.includes(newStage) && newStage !== recruit.stage) {
      setPendingExitStage(newStage);
    } else {
      onStageChange(newStage);
    }
  };
  
  const confirmExitStage = () => {
    if (pendingExitStage) {
      onStageChange(pendingExitStage);
      setPendingExitStage(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Recruiter Info - show for early stages */}
      {isEarlyStage && recruit.recruiterName && (
        <div className="bg-muted/50 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>Recruited by</span>
          </div>
          <p className="font-medium">{recruit.recruiterName}</p>
        </div>
      )}
      
      {/* iPad Assignment - only show for Signed+ stages */}
      {isRookie && !isEarlyStage && !recruitRepData?.ramp_phase_4_complete && (
        <IpadAssignmentCard 
          recruit={recruit}
          recruitRepData={recruitRepData}
          queryClient={queryClient}
        />
      )}
      
      {/* Blitz Commitments - show for all */}
      <BlitzManagementSection 
        recruit={recruit}
        recruitRepData={recruitRepData}
        queryClient={queryClient}
      />
      
      {/* Blitz Readiness Warnings - already filters internally */}
      <BlitzReadinessWarnings 
        recruit={recruit}
        recruitRepData={recruitRepData}
      />
      
      {/* Stage Selector */}
      <div className={stageShake ? 'animate-shake' : ''}>
        <Label className="text-sm text-muted-foreground">Stage</Label>
        <Select 
          value={recruit.stage} 
          onValueChange={handleStageSelect}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* Progression Stages */}
            {PROGRESSION_STAGES.map((stage) => {
              const isDisabled = stageLocked && stage !== recruit.stage;
              return (
                <SelectItem 
                  key={stage} 
                  value={stage}
                  disabled={isDisabled}
                  className={isDisabled ? 'opacity-50' : ''}
                >
                  {stage}
                </SelectItem>
              );
            })}
            
            {/* Separator before exit stages */}
            <SelectSeparator className="my-1" />
            
            {/* Exit Stages - always available */}
            <div className="px-2 py-1">
              <span className="text-xs text-muted-foreground">Exit Options</span>
            </div>
            {EXIT_STAGE_OPTIONS.map((stage) => (
              <SelectItem 
                key={stage} 
                value={stage}
                className="text-muted-foreground"
              >
                {stage}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {stageLocked && (
          <p className="text-xs text-muted-foreground mt-1">
            Most stages locked until Onboarding ✅ is complete
          </p>
        )}
      </div>
      
      {/* Exit Stage Confirmation Dialog */}
      <AlertDialog open={!!pendingExitStage} onOpenChange={(open) => !open && setPendingExitStage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as {pendingExitStage}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark {recruitFirstName} as "{pendingExitStage}"? 
              This will remove them from your active recruiting pipeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmExitStage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, mark as {pendingExitStage}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// iPad Assignment Card
const IpadAssignmentCard = ({ 
  recruit, 
  recruitRepData,
  queryClient 
}: { 
  recruit: Recruit;
  recruitRepData: RecruitRepData | null;
  queryClient: any;
}) => {
  const hasIpad = recruitRepData?.ipad_assigned ?? false;
  
  const handleToggle = async (checked: boolean) => {
    // Optimistic update
    queryClient.setQueryData(['recruit-rep-data', recruit.notionPageId], (old: any) => 
      old ? { ...old, ipad_assigned: checked } : old
    );
    
    try {
      const { error: supabaseError } = await supabase
        .from('reps')
        .update({ ipad_assigned: checked })
        .eq('notion_page_id', recruit.notionPageId);
      
      if (supabaseError) throw supabaseError;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.functions.invoke('update-rookie-status', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { rookieNotionPageId: recruit.notionPageId, ipadAssigned: checked },
        });
      }
      
      toast.success(checked ? 'iPad assigned' : 'iPad unassigned');
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
    } catch (error) {
      queryClient.setQueryData(['recruit-rep-data', recruit.notionPageId], (old: any) => 
        old ? { ...old, ipad_assigned: !checked } : old
      );
      toast.error("Couldn't update iPad status");
    }
  };

  return (
    <div className={`rounded-xl p-4 ${hasIpad ? 'bg-muted/50' : 'bg-amber-500/10 border border-amber-500/30'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            hasIpad ? 'bg-muted' : 'bg-amber-500/20'
          }`}>
            <Tablet className={`h-5 w-5 ${hasIpad ? 'text-muted-foreground' : 'text-amber-600'}`} />
          </div>
          <div>
            <p className={`text-sm font-medium ${hasIpad ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-400'}`}>
              {hasIpad ? 'iPad Assigned' : 'No iPad Assigned'}
            </p>
            <p className="text-xs text-muted-foreground">
              {hasIpad ? 'Ready for the field' : 'Needs iPad before blitz'}
            </p>
          </div>
        </div>
        <Switch
          checked={hasIpad}
          onCheckedChange={handleToggle}
        />
      </div>
    </div>
  );
};

// Blitz Management Section
const BlitzManagementSection = ({ 
  recruit, 
  recruitRepData, 
  queryClient 
}: { 
  recruit: Recruit; 
  recruitRepData: RecruitRepData | null; 
  queryClient: any;
}) => {
  const { allBlitzes, pastBlitzes: allPastBlitzes } = useBlitzes();
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  
  // Fetch declined blitzes for this recruit
  const { data: declinedBlitzIds = [] } = useQuery({
    queryKey: ['recruit-declined-blitzes', recruit?.notionPageId],
    queryFn: async () => {
      if (!recruit?.notionPageId) return [];
      const { data, error } = await supabase
        .from('blitz_declines')
        .select('blitz_id')
        .eq('rep_notion_page_id', recruit.notionPageId);
      
      if (error) return [];
      return data.map(d => d.blitz_id);
    },
    enabled: !!recruit?.notionPageId,
    staleTime: 30000,
  });
  
  const committedBlitzIds = useMemo(() => {
    const rawFromSupabase = recruitRepData?.committed_blitzes;
    const rawFromNotion = recruit?.committedBlitzes;
    const raw = (rawFromSupabase && Array.isArray(rawFromSupabase) && rawFromSupabase.length > 0) 
      ? rawFromSupabase 
      : rawFromNotion;
    if (!raw || !Array.isArray(raw)) return [];
    return raw.map((item: string | { id: string }) => 
      typeof item === 'string' ? item : item?.id
    ).filter(Boolean) as string[];
  }, [recruitRepData?.committed_blitzes, recruit?.committedBlitzes]);
  
  const now = new Date();
  const pastBlitzes = useMemo(() => {
    return allPastBlitzes.filter(blitz => committedBlitzIds.includes(blitz.id));
  }, [allPastBlitzes, committedBlitzIds]);
  
  const futureBlitzes = allBlitzes;
  const committedFutureCount = futureBlitzes.filter(b => committedBlitzIds.includes(b.id)).length;
  const declinedFutureCount = futureBlitzes.filter(b => declinedBlitzIds.includes(b.id) && !committedBlitzIds.includes(b.id)).length;
  
  const handleToggleBlitz = async (blitzId: string, blitzName: string, isCurrentlyCommitted: boolean) => {
    if (!recruit?.notionPageId) return;
    
    setIsUpdating(blitzId);
    const newCommittedBlitzIds = isCurrentlyCommitted
      ? committedBlitzIds.filter(id => id !== blitzId)
      : [...committedBlitzIds, blitzId];
    
    queryClient.setQueryData(['recruit-rep-data', recruit.notionPageId], (old: any) => 
      old ? { ...old, committed_blitzes: newCommittedBlitzIds } : old
    );
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');
      
      const { error } = await supabase.functions.invoke('update-blitz-commitment', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          repNotionPageId: recruit.notionPageId,
          blitzPageIds: newCommittedBlitzIds,
        },
      });
      
      if (error) throw error;
      toast.success(isCurrentlyCommitted ? `Removed from ${blitzName}` : `Committed to ${blitzName}`);
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      // Clear declined status if committing
      if (!isCurrentlyCommitted) {
        queryClient.invalidateQueries({ queryKey: ['recruit-declined-blitzes', recruit.notionPageId] });
      }
    } catch (error) {
      queryClient.setQueryData(['recruit-rep-data', recruit.notionPageId], (old: any) => 
        old ? { ...old, committed_blitzes: committedBlitzIds } : old
      );
      toast.error("Couldn't update blitz commitment");
    } finally {
      setIsUpdating(null);
    }
  };
  
  const getSummaryText = () => {
    if (committedFutureCount === 0 && pastBlitzes.length === 0 && declinedFutureCount === 0) {
      return "No blitz history yet";
    }
    const parts: string[] = [];
    if (committedFutureCount > 0) parts.push(`${committedFutureCount} upcoming`);
    if (pastBlitzes.length > 0) parts.push(`${pastBlitzes.length} attended`);
    if (declinedFutureCount > 0) parts.push(`${declinedFutureCount} declined`);
    return parts.join(' · ');
  };
  
  if (futureBlitzes.length === 0 && pastBlitzes.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Plane className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">Blitz Commitments</p>
              <p className="text-xs text-muted-foreground">{getSummaryText()}</p>
            </div>
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="mt-3 space-y-4 pl-2">
          {pastBlitzes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <History className="h-3 w-3" />
                <span>Previous Blitzes</span>
              </div>
              {pastBlitzes.map((blitz) => (
                <div key={blitz.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Check className="h-3 w-3 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{blitz.name}</p>
                      <p className="text-xs text-muted-foreground/70">
                        {format(new Date(blitz.date), 'MMM d')}
                        {blitz.endDate && ` - ${format(new Date(blitz.endDate), 'MMM d')}`}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs text-green-600 border-green-600/30">Attended</Badge>
                </div>
              ))}
            </div>
          )}
          
          {futureBlitzes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>Upcoming Blitzes</span>
              </div>
              {futureBlitzes.map((blitz) => {
                const isCommitted = committedBlitzIds.includes(blitz.id);
                const isDeclined = declinedBlitzIds.includes(blitz.id) && !isCommitted;
                const blitzDate = new Date(blitz.date);
                const isLoading = isUpdating === blitz.id;
                const daysUntil = getDaysUntilBlitz(blitz.date);
                
                return (
                  <div key={blitz.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    isCommitted 
                      ? 'bg-primary/5 border-primary/30' 
                      : isDeclined 
                        ? 'bg-destructive/5 border-destructive/30' 
                        : 'bg-muted/50 border-border'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isCommitted 
                          ? 'bg-primary/20 text-primary' 
                          : isDeclined 
                            ? 'bg-destructive/20 text-destructive'
                            : 'bg-muted text-muted-foreground'
                      }`}>
                        {isCommitted ? <Plane className="h-4 w-4" /> : isDeclined ? <X className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${isDeclined ? 'line-through text-muted-foreground' : ''}`}>
                            {blitz.name}
                          </p>
                          {isDeclined && (
                            <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
                              Declined
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(blitzDate, 'MMM d')}
                          {blitz.endDate && ` - ${format(new Date(blitz.endDate), 'MMM d')}`}
                          {daysUntil !== null && daysUntil <= 14 && daysUntil >= 0 && (
                            <span className="ml-1 text-amber-500">
                              · {daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `${daysUntil}d away`}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant={isCommitted ? 'default' : 'outline'}
                      size="sm"
                      disabled={isLoading}
                      onClick={() => handleToggleBlitz(blitz.id, blitz.name, isCommitted)}
                      className="min-w-[80px]"
                    >
                      {isLoading ? '...' : isCommitted ? <><Check className="h-3 w-3 mr-1" />Going</> : 'Commit'}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

// Blitz Readiness Warnings
const BlitzReadinessWarnings = ({ 
  recruit, 
  recruitRepData 
}: { 
  recruit: Recruit;
  recruitRepData: RecruitRepData | null;
}) => {
  if (!recruitRepData) return null;
  
  // Check if recruit is in a stage where iPad matters (Signed+, excluding exit stages)
  const stageLower = (recruit.stage || '').toLowerCase();
  const earlyStages = ['100_list', '100 list', 'evaluating', 'reached_out', 'reached out'];
  const exitStages = ['not interested', 'potential follow up', 'signed but not interested'];
  const isEarlyStage = earlyStages.some(s => stageLower.includes(s));
  const isExitStage = exitStages.some(s => stageLower.includes(s));
  const isSignedOrBeyond = !isEarlyStage && !isExitStage;
  
  const committedBlitzes = recruitRepData.committed_blitzes as string[] | null;
  const hasBlitzCommitment = committedBlitzes && committedBlitzes.length > 0;
  const daysToBlitz = getDaysUntilBlitz(recruitRepData.blitz_trip_date);
  const isBlitzApproaching = daysToBlitz !== null && daysToBlitz >= 0 && daysToBlitz <= 21;
  
  const isRampComplete = recruitRepData.ramp_phase_4_complete === true;
  const isOnboardingComplete = recruitRepData.onboarding_complete === true;
  const hasIpad = recruitRepData.ipad_assigned === true;
  
  // Only show warnings for Signed+ stages
  const showIpadWarning = isSignedOrBeyond && !hasIpad;
  const showOnboardingWarning = isSignedOrBeyond && !isOnboardingComplete;
  const showRampWarning = isSignedOrBeyond && !isRampComplete;
  
  const hasReadinessIssues = hasBlitzCommitment && isBlitzApproaching && (showRampWarning || showOnboardingWarning || showIpadWarning);
  
  if (!hasReadinessIssues) return null;
  
  const issues: string[] = [];
  if (showOnboardingWarning) issues.push('Onboarding incomplete');
  if (showRampWarning) issues.push('Ramp to Blitz incomplete');
  if (showIpadWarning) issues.push('No iPad assigned');
  
  return (
    <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-2">
        <AlertTriangle className="h-4 w-4" />
        Blitz {formatDaysUntilBlitz(daysToBlitz)} - Not Ready
      </div>
      <ul className="text-xs text-destructive/80 space-y-1 ml-6">
        {issues.map((issue, i) => (
          <li key={i}>• {issue}</li>
        ))}
      </ul>
    </div>
  );
};
