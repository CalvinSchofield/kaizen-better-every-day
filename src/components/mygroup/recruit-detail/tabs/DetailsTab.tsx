import { useState, useMemo, useEffect, useCallback } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { getDaysUntilBlitz, formatDaysUntilBlitz, parseDateAsLocal, formatBlitzDate } from "@/utils/blitzDateUtils";
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
  Pencil,
  Trash2,
  UserPlus,
  Loader2,
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Recruit } from "@/hooks/useGroupRecruits";
import { useBlitzes } from "@/hooks/useBlitzes";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { RecruitRepData } from "../types";
import { ALL_STAGES, getFirstName } from "../utils";
import { STAGES, EXIT_STAGES as EXIT_STAGE_LIST } from "@/utils/stageConstants";
import { EditRecruitDrawer } from "../EditRecruitDrawer";
import { DeleteRecruitConfirmDrawer } from "../DeleteRecruitConfirmDrawer";

interface DetailsTabProps {
  recruit: Recruit;
  recruitRepData: RecruitRepData | null;
  recruitYtdFP: number;
  onStageChange: (newStage: string) => void;
  stageShake: boolean;
  /** Called when recruit is deleted - used to close the detail drawer */
  onDeleted?: () => void;
}

// Exit stages that are always allowed and permanent exit stages that need confirmation
// Note: confirmation is now handled in RecruitDetailDrawer, not here
const EXIT_STAGES: string[] = [...EXIT_STAGE_LIST];

// Separate stages into progression and exit for display purposes
const PROGRESSION_STAGES = ALL_STAGES.filter(s => !EXIT_STAGES.includes(s));

export const DetailsTab = ({
  recruit,
  recruitRepData,
  recruitYtdFP,
  onStageChange,
  stageShake,
  onDeleted,
}: DetailsTabProps) => {
  const queryClient = useQueryClient();
  const { data: teamAccess } = useTeamAccess();
  const recruitFirstName = getFirstName(recruit.name);
  const isRookie = recruitRepData && (recruitRepData.year === 'Rookie' || !recruitRepData.year);
  const hasCompletedOnboarding = recruitRepData?.onboarding_complete === true;
  
  // Check if user has leader access (can edit)
  const canEdit = teamAccess?.accessLevel && teamAccess.accessLevel !== 'none';
  // Check if user is area director (can delete)
  const isAreaDirector = teamAccess?.accessLevel === 'area_director';
  
  // Check if recruit is in an early stage (not yet signed)
  const stageLower = (recruit.stage || '').toLowerCase();
  const earlyStages = ['100_list', '100 list', 'evaluating', 'reached_out', 'reached out'];
  const isEarlyStage = earlyStages.some(s => stageLower.includes(s));
  
  // Only lock stages for signed+ rookies who haven't completed onboarding
  // Early-stage recruits can move freely between 100 List, Reached Out, Evaluating, and Signed
  const stageLocked = isRookie && !hasCompletedOnboarding && !isEarlyStage;
  
  // Check if recruit is Signed or beyond (for exit stage filtering)
  const signedPlusStages = ['signed', 'shadow', 'sold'];
  const isSignedOrBeyond = signedPlusStages.some(s => stageLower.includes(s)) && !stageLower.includes('not interested');
  
  // For Signed+ recruits, only these exit stages make sense
  // Not Interested is only for early stage (100 List, Reached Out, Evaluating)
  const availableExitStages = isSignedOrBeyond
    ? EXIT_STAGES.filter(s => s === STAGES.POTENTIAL_FOLLOW_UP || s === STAGES.SIGNED_BUT_NOT_INTERESTED)
    : EXIT_STAGES;
  
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDrawerOpen, setDeleteDrawerOpen] = useState(false);
  const [creatingAppAccount, setCreatingAppAccount] = useState(false);
  
  // Check if recruit already has an app account (reps record)
  const hasAppAccount = !!recruitRepData;
  const canCreateAppAccount = canEdit && recruit.email && !hasAppAccount;
  
  const handleCreateAppAccount = async () => {
    if (!recruit.email) {
      toast.error('Recruit must have an email to create app account');
      return;
    }
    
    setCreatingAppAccount(true);
    try {
      // Get recruiter info for team_leader fields
      let teamLeaderName: string | null = null;
      let teamLeaderPhone: string | null = null;
      
      if (recruit.recruiterUserId) {
        const { data: recruiterData } = await supabase
          .from('reps')
          .select('name, phone')
          .eq('user_id', recruit.recruiterUserId)
          .single();
        
        if (recruiterData) {
          teamLeaderName = recruiterData.name;
          teamLeaderPhone = recruiterData.phone;
        }
      }
      
      // Create the ghost rep record
      const { error } = await supabase.from('reps').insert({
        name: recruit.name,
        email: recruit.email,
        phone: recruit.phone || null,
        stage: recruit.stage || 'Signed',
        year: 'Rookie',
        team_leader: teamLeaderName,
        team_leader_phone: teamLeaderPhone,
        onboarding_complete: false,
        trainings_complete: false,
        slack_joined: false,
        ramp_phase_1_complete: false,
        ramp_phase_2_complete: false,
        ramp_phase_3_complete: false,
        ramp_phase_4_complete: false,
        blitz_ready: false,
        ipad_assigned: false,
      });
      
      if (error) throw error;
      
      toast.success(`App account created for ${recruitFirstName}! They can now sign up.`);
      queryClient.invalidateQueries({ queryKey: ['recruit-rep-data', recruit.id] });
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
    } catch (error: any) {
      console.error('Failed to create app account:', error);
      if (error.code === '23505') {
        toast.error('An account with this email already exists');
      } else {
        toast.error('Failed to create app account');
      }
    } finally {
      setCreatingAppAccount(false);
    }
  };
  
  const handleStageSelect = (newStage: string) => {
    // Pass stage change directly to parent - confirmation is handled there
    onStageChange(newStage);
  };

  return (
    <div className="space-y-4">
      {/* Edit Button - only for leaders */}
      {canEdit && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditDrawerOpen(true)}
            className="flex-1"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit Recruit Details
          </Button>
          
          {/* Delete Button - only for area directors */}
          {isAreaDirector && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDrawerOpen(true)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
      
      {/* Create App Account Button - for recruits without reps record */}
      {canCreateAppAccount && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">No App Account Yet</p>
                <p className="text-xs text-muted-foreground">
                  Create account so {recruitFirstName} can sign up
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleCreateAppAccount}
              disabled={creatingAppAccount}
            >
              {creatingAppAccount ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Create'
              )}
            </Button>
          </div>
        </div>
      )}
      
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
              // For early-stage recruits, allow moving to 100 List, Reached Out, Evaluating, and Signed
              const allowedForEarlyStage = ['100 List', 'Reached Out', 'Evaluating', 'Signed'].includes(stage);
              const isDisabled = stageLocked && stage !== recruit.stage && !(isEarlyStage && allowedForEarlyStage);
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
            
            {/* Exit Stages - filtered based on current stage */}
            <div className="px-2 py-1">
              <span className="text-xs text-muted-foreground">Exit Options</span>
            </div>
            {availableExitStages.map((stage) => (
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
      
      {/* Edit Recruit Drawer */}
      <EditRecruitDrawer
        open={editDrawerOpen}
        onOpenChange={setEditDrawerOpen}
        recruit={recruit}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
        }}
      />
      
      {/* Delete Recruit Confirmation Drawer - Area Directors only */}
      {isAreaDirector && (
        <DeleteRecruitConfirmDrawer
          open={deleteDrawerOpen}
          onOpenChange={setDeleteDrawerOpen}
          recruitId={recruit.id}
          recruitName={recruit.name}
          recruitNotionPageId={recruit.id}
          onDeleted={onDeleted}
        />
      )}
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
    queryClient.setQueryData(['recruit-rep-data', recruit.id], (old: any) => 
      old ? { ...old, ipad_assigned: checked } : old
    );
    
    try {
      const { error: supabaseError } = await supabase
        .from('reps')
        .update({ ipad_assigned: checked })
        .eq('id', recruit.id);
      
      if (supabaseError) throw supabaseError;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.functions.invoke('update-rookie-status', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { rookieId: recruit.id, ipadAssigned: checked },
        });
      }
      
      toast.success(checked ? 'iPad assigned' : 'iPad unassigned');
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
    } catch (error) {
      queryClient.setQueryData(['recruit-rep-data', recruit.id], (old: any) => 
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
    queryKey: ['recruit-declined-blitzes', recruit?.id],
    queryFn: async () => {
      if (!recruit?.id) return [];
      const { data, error } = await supabase
        .from('blitz_declines')
        .select('blitz_id')
        .eq('rep_id', recruit.id);
      
      if (error) return [];
      return data.map(d => d.blitz_id);
    },
    enabled: !!recruit?.id,
    staleTime: 30000,
  });
  
  // Fetch committed blitzes from recruit_blitzes table (fallback for recruits without rep record)
  const { data: recruitBlitzesData = [] } = useQuery({
    queryKey: ['recruit-blitzes-commitments', recruit?.id],
    queryFn: async () => {
      if (!recruit?.id) return [];
      const { data, error } = await supabase
        .from('recruit_blitzes')
        .select('blitz_id')
        .eq('recruit_id', recruit.id);
      
      if (error) return [];
      return data.map(d => d.blitz_id);
    },
    enabled: !!recruit?.id,
    staleTime: 5000, // Lower stale time for faster UI sync
  });
  
  // Extract committed blitz data - prioritize reps table, then recruit_blitzes, then legacy Notion data
  const committedBlitzData = useMemo(() => {
    // Priority 1: reps.committed_blitzes (for recruits with rep record)
    const rawFromSupabase = recruitRepData?.committed_blitzes;
    if (rawFromSupabase && Array.isArray(rawFromSupabase) && rawFromSupabase.length > 0) {
      const ids: string[] = [];
      const names: string[] = [];
      rawFromSupabase.forEach((item: string | { id?: string; name?: string }) => {
        if (typeof item === 'string') {
          ids.push(item);
        } else if (item) {
          if (item.id) ids.push(item.id);
          if (item.name) names.push(item.name.toLowerCase().trim());
        }
      });
      return { ids, names };
    }
    
    // Priority 2: recruit_blitzes table (for recruits WITHOUT rep record - like Weston)
    if (recruitBlitzesData.length > 0) {
      return { ids: recruitBlitzesData, names: [] as string[] };
    }
    
    // Priority 3: Legacy Notion data
    const rawFromNotion = recruit?.committedBlitzes;
    if (!rawFromNotion || !Array.isArray(rawFromNotion)) return { ids: [] as string[], names: [] as string[] };
    
    const ids: string[] = [];
    const names: string[] = [];
    rawFromNotion.forEach((item: string | { id?: string; name?: string }) => {
      if (typeof item === 'string') {
        ids.push(item);
      } else if (item) {
        if (item.id) ids.push(item.id);
        if (item.name) names.push(item.name.toLowerCase().trim());
      }
    });
    return { ids, names };
  }, [recruitRepData?.committed_blitzes, recruitBlitzesData, recruit?.committedBlitzes]);
  
  // Helper to check if a blitz is committed (by ID or name match)
  const isBlitzCommitted = useCallback((blitz: { id: string; name: string }) => {
    return committedBlitzData.ids.includes(blitz.id) || 
           committedBlitzData.names.includes(blitz.name.toLowerCase().trim());
  }, [committedBlitzData]);
  
  // For backward compatibility, keep committedBlitzIds for the update function
  const committedBlitzIds = committedBlitzData.ids;
  
  const now = new Date();
  const pastBlitzes = useMemo(() => {
    return allPastBlitzes.filter(blitz => isBlitzCommitted(blitz));
  }, [allPastBlitzes, isBlitzCommitted]);
  
  const futureBlitzes = allBlitzes;
  const committedFutureCount = futureBlitzes.filter(b => isBlitzCommitted(b)).length;
  const declinedFutureCount = futureBlitzes.filter(b => declinedBlitzIds.includes(b.id) && !isBlitzCommitted(b)).length;
  
  const handleToggleBlitz = async (blitzId: string, blitzName: string, isCurrentlyCommitted: boolean) => {
    if (!recruit?.id) return;
    
    setIsUpdating(blitzId);
    const newCommittedBlitzIds = isCurrentlyCommitted
      ? committedBlitzIds.filter(id => id !== blitzId)
      : [...committedBlitzIds, blitzId];
    
    // Optimistic update for reps table data
    queryClient.setQueryData(['recruit-rep-data', recruit.id, recruit.email, recruit.name], (old: any) => 
      old ? { ...old, committed_blitzes: newCommittedBlitzIds } : old
    );
    
    // Optimistic update for recruit_blitzes table (for recruits without rep record)
    queryClient.setQueryData(['recruit-blitzes-commitments', recruit.id], newCommittedBlitzIds);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');
      
      const { error } = await supabase.functions.invoke('update-blitz-commitment', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          repId: recruit.id,
          blitzPageIds: newCommittedBlitzIds,
        },
      });
      
      if (error) throw error;
      toast.success(isCurrentlyCommitted ? `Removed from ${blitzName}` : `Committed to ${blitzName}`);
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      queryClient.invalidateQueries({ queryKey: ['recruit-rep-data', recruit.id, recruit.email, recruit.name] });
      queryClient.invalidateQueries({ queryKey: ['recruit-blitzes-commitments', recruit.id] });
      // Clear declined status if committing
      if (!isCurrentlyCommitted) {
        queryClient.invalidateQueries({ queryKey: ['recruit-declined-blitzes', recruit.id] });
      }
    } catch (error) {
      // Rollback both optimistic updates
      queryClient.setQueryData(['recruit-rep-data', recruit.id, recruit.email, recruit.name], (old: any) => 
        old ? { ...old, committed_blitzes: committedBlitzIds } : old
      );
      queryClient.setQueryData(['recruit-blitzes-commitments', recruit.id], committedBlitzIds);
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
    if (declinedFutureCount > 0) {
      // Show the actual blitz name(s) that were declined
      const declinedBlitzNames = futureBlitzes
        .filter(b => declinedBlitzIds.includes(b.id) && !isBlitzCommitted(b))
        .map(b => b.name);
      if (declinedBlitzNames.length === 1) {
        parts.push(`declined ${declinedBlitzNames[0]}`);
      } else {
        parts.push(`${declinedFutureCount} declined`);
      }
    }
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
              {pastBlitzes.map((blitz) => {
                const isLoading = isUpdating === blitz.id;
                return (
                  <div key={blitz.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Check className="h-3 w-3 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{blitz.name}</p>
                        <p className="text-xs text-muted-foreground/70">
                          {formatBlitzDate(blitz.date, 'MMM d')}
                          {blitz.endDate && ` - ${formatBlitzDate(blitz.endDate, 'MMM d')}`}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isLoading}
                      onClick={() => handleToggleBlitz(blitz.id, blitz.name, true)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      {isLoading ? '...' : <X className="h-4 w-4" />}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          
          {futureBlitzes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>Upcoming Blitzes</span>
              </div>
              {futureBlitzes.map((blitz) => {
                const isCommitted = isBlitzCommitted(blitz);
                const isDeclined = declinedBlitzIds.includes(blitz.id) && !isCommitted;
                const blitzDate = parseDateAsLocal(blitz.date);
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
                          {blitzDate ? format(blitzDate, 'MMM d') : ''}
                          {blitz.endDate && ` - ${formatBlitzDate(blitz.endDate, 'MMM d')}`}
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
  const { allBlitzes } = useBlitzes();
  
  // Calculate closest upcoming blitz from committed blitzes
  const closestBlitz = useMemo(() => {
    if (!recruitRepData?.committed_blitzes || !allBlitzes.length) return null;
    
    const committedIds = (recruitRepData.committed_blitzes as (string | { id: string })[])
      .map(b => typeof b === 'string' ? b : (b as { id: string })?.id);
    
    if (committedIds.length === 0) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const committedUpcoming = allBlitzes
      .filter(blitz => committedIds.includes(blitz.id))
      .filter(blitz => {
        if (!blitz.date) return false;
        const blitzDate = parseDateAsLocal(blitz.date);
        return blitzDate && blitzDate >= today;
      })
      .sort((a, b) => {
        const dateA = parseDateAsLocal(a.date);
        const dateB = parseDateAsLocal(b.date);
        return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
      });
    
    if (committedUpcoming.length === 0) return null;
    
    const closest = committedUpcoming[0];
    const blitzDate = parseDateAsLocal(closest.date);
    if (!blitzDate) return null;
    
    const diffTime = blitzDate.getTime() - today.getTime();
    const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return { name: closest.name, daysUntil };
  }, [recruitRepData?.committed_blitzes, allBlitzes]);
  
  if (!recruitRepData) return null;
  
  // Vets and Sophomores don't need ramp-to-blitz, so skip ramp warnings for them
  const isRookie = recruitRepData.year === 'Rookie' || !recruitRepData.year;
  
  // Check if recruit is in a stage where iPad matters (Signed+, excluding exit stages)
  const stageLower = (recruit.stage || '').toLowerCase();
  const earlyStages = ['100_list', '100 list', 'evaluating', 'reached_out', 'reached out'];
  const exitStages = ['not interested', 'potential follow up', 'signed but not interested'];
  const isEarlyStage = earlyStages.some(s => stageLower.includes(s));
  const isExitStage = exitStages.some(s => stageLower.includes(s));
  const isSignedOrBeyond = !isEarlyStage && !isExitStage;
  
  const committedBlitzes = recruitRepData.committed_blitzes as string[] | null;
  const hasBlitzCommitment = committedBlitzes && committedBlitzes.length > 0;
  const daysToBlitz = closestBlitz?.daysUntil ?? null;
  const isBlitzApproaching = daysToBlitz !== null && daysToBlitz >= 0 && daysToBlitz <= 21;
  
  const isRampComplete = recruitRepData.ramp_phase_4_complete === true;
  const isOnboardingComplete = recruitRepData.onboarding_complete === true;
  const hasIpad = recruitRepData.ipad_assigned === true;
  
  // Only show warnings for Signed+ stages
  const showIpadWarning = isSignedOrBeyond && !hasIpad && isRookie; // Only rookies need iPad tracking
  const showOnboardingWarning = isSignedOrBeyond && !isOnboardingComplete && isRookie; // Only rookies need onboarding
  const showRampWarning = isSignedOrBeyond && !isRampComplete && isRookie; // Only rookies need ramp-to-blitz
  
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
