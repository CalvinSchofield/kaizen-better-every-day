import { useState, useMemo, useCallback } from "react";
import { PurposeDisplayCard } from "@/components/goals/PurposeDisplayCard";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
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
  Heart,
  Target,
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

// Mobile-optimized: use local session cache, no network refresh
const getSessionFast = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return { session, user: session?.user ?? null };
};
import { toast } from "sonner";
import { Recruit } from "@/hooks/useGroupRecruits";
import { useBlitzes } from "@/hooks/useBlitzes";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { RecruitRepData } from "../types";
import { ALL_STAGES, getFirstName } from "../utils";
import { STAGES, EXIT_STAGES as EXIT_STAGE_LIST } from "@/utils/stageConstants";
import { EditRecruitDrawer } from "../EditRecruitDrawer";
import { DeleteRecruitConfirmDrawer } from "../DeleteRecruitConfirmDrawer";
import { cn } from "@/lib/utils";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { getRoleLabel, hasMinAccess, ASSIGNABLE_ROLES, ROLE_HIERARCHY, getAssignableRoles, getRoleJumpInfo, type AccessLevel } from "@/utils/roleHierarchy";
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
import {
  Select as RoleSelect,
  SelectContent as RoleSelectContent,
  SelectItem as RoleSelectItem,
  SelectTrigger as RoleSelectTrigger,
  SelectValue as RoleSelectValue,
} from "@/components/ui/select";

interface DetailsTabProps {
  recruit: Recruit;
  recruitRepData: RecruitRepData | null;
  recruitYtdFP: number;
  onStageChange: (newStage: string) => void;
  stageShake: boolean;
  /** Called when recruit is deleted - used to close the detail drawer */
  onDeleted?: () => void;
  purposeStatement?: string | null;
  purposeUpdatedAt?: string | null;
}

// Exit stages that are always allowed and permanent exit stages that need confirmation
const EXIT_STAGES: string[] = [...EXIT_STAGE_LIST];

// Separate stages into progression and exit for display purposes
const PROGRESSION_STAGES = ALL_STAGES.filter(s => !EXIT_STAGES.includes(s));

// Quick objections for Watch Out For section
const QUICK_OBJECTIONS = [
  'Considering internship',
  'Other D2D opportunities',
  'Haven\'t met spouse yet',
  'Bad D2D experience',
];

export const DetailsTab = ({
  recruit,
  recruitRepData,
  recruitYtdFP,
  onStageChange,
  stageShake,
  onDeleted,
  purposeStatement,
  purposeUpdatedAt,
}: DetailsTabProps) => {
  const queryClient = useQueryClient();
  const { data: teamAccess } = useTeamAccess();
  const { userId: currentUserId } = useCurrentUserId();
  const recruitFirstName = getFirstName(recruit.name);
  const isRookie = recruitRepData && (recruitRepData.year === 'Rookie' || !recruitRepData.year);
  const hasCompletedOnboarding = recruitRepData?.onboarding_complete === true;
  const accessLevel = (teamAccess?.accessLevel || 'none') as AccessLevel;
  
  // Fetch additional recruit details for the new fields
  const { data: recruitDetails } = useQuery({
    queryKey: ['recruit-details-extra', recruit.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recruits')
        .select('significant_other_name, watch_out_notes, recruiter_user_id')
        .eq('id', recruit.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    staleTime: 30 * 1000,
  });

  // Fetch recruit's current role from user_roles (if they have an app account)
  const { data: recruitRole } = useQuery({
    queryKey: ['recruit-role', recruit.id],
    queryFn: async () => {
      // First get the user_id from reps table
      const { data: repData } = await supabase
        .from('reps')
        .select('user_id')
        .eq('id', recruit.id)
        .maybeSingle();
      
      if (!repData?.user_id) return null;
      
      const { data: roleData } = await supabase
        .from('user_roles' as any)
        .select('id, role, user_id')
        .eq('user_id', repData.user_id)
        .maybeSingle();
      
      return roleData ? { id: (roleData as any).id, role: (roleData as any).role, user_id: (roleData as any).user_id, recruitUserId: repData.user_id } : null;
    },
    enabled: !!recruitRepData,
    staleTime: 30 * 1000,
  });

  // Role edit state
  const [editingRole, setEditingRole] = useState(false);
  const [newRole, setNewRole] = useState<string>('');
  const [showRoleChangeConfirm, setShowRoleChangeConfirm] = useState(false);
  const [showRoleRemoveConfirm, setShowRoleRemoveConfirm] = useState(false);

  // Can this user edit the recruit's role?
  // Bootstrap authority is restricted to Calvin Schofield only
  const BOOTSTRAP_USER_ID = '843dac61-139d-4511-a057-c3bf359a9c07';
  const isBootstrapUser = currentUserId === BOOTSTRAP_USER_ID;
  const isOriginalInviter = recruitDetails?.recruiter_user_id === currentUserId;
  const canEditRole = recruitRole && (
    isOriginalInviter || hasMinAccess(accessLevel, 'mgmt_group_lead')
  );

  // Determine assignable roles for editing
  const editableRoles = useMemo(() => {
    if (isBootstrapUser && isOriginalInviter) return ASSIGNABLE_ROLES; // Bootstrap authority (Calvin only)
    return getAssignableRoles(accessLevel);
  }, [accessLevel, isBootstrapUser, isOriginalInviter]);

  const roleJumpInfo = useMemo(() => {
    if (!newRole) return null;
    return getRoleJumpInfo(accessLevel, newRole as AccessLevel);
  }, [newRole, accessLevel]);

  // Role update mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ action, role }: { action: 'update' | 'remove'; role?: string }) => {
      if (!recruitRole?.recruitUserId) throw new Error('No user ID');
      
      if (action === 'remove') {
        await supabase
          .from('user_roles' as any)
          .delete()
          .eq('user_id', recruitRole.recruitUserId)
          .eq('id', recruitRole.id);
      } else if (role) {
        await supabase
          .from('user_roles' as any)
          .update({ role })
          .eq('user_id', recruitRole.recruitUserId)
          .eq('id', recruitRole.id);
      }
    },
    onSuccess: (_, variables) => {
      const msg = variables.action === 'remove' 
        ? `Role removed from ${recruitFirstName}`
        : `${recruitFirstName}'s role updated to ${getRoleLabel(variables.role as AccessLevel)}`;
      toast.success(msg);
      queryClient.invalidateQueries({ queryKey: ['recruit-role', recruit.id] });
      queryClient.invalidateQueries({ queryKey: ['team-access'] });
      setEditingRole(false);
      setNewRole('');
    },
    onError: () => toast.error('Failed to update role'),
  });

  const handleRoleChangeConfirm = () => {
    setShowRoleChangeConfirm(false);
    updateRoleMutation.mutate({ action: 'update', role: newRole });
  };

  const handleRoleRemoveConfirm = () => {
    setShowRoleRemoveConfirm(false);
    updateRoleMutation.mutate({ action: 'remove' });
  };
  
  // Check if user has leader access (can edit)
  const canEdit = teamAccess?.accessLevel && teamAccess.accessLevel !== 'none';
  // Check if user is area director (can delete)
  const isAreaDirector = teamAccess?.accessLevel === 'area_director';
  
  // Check if recruit is in an early stage (not yet signed)
  const stageLower = (recruit.stage || '').toLowerCase();
  const earlyStages = ['100_list', '100 list', 'evaluating', 'reached_out', 'reached out'];
  const isEarlyStage = earlyStages.some(s => stageLower.includes(s));
  
  // Only lock stages for signed+ rookies who haven't completed onboarding
  const stageLocked = isRookie && !hasCompletedOnboarding && !isEarlyStage;
  
  // Check if recruit is Signed or beyond (for exit stage filtering)
  const signedPlusStages = ['signed', 'shadow', 'sold'];
  const isSignedOrBeyond = signedPlusStages.some(s => stageLower.includes(s)) && !stageLower.includes('not interested');
  
  // For Signed+ recruits, only these exit stages make sense
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
    onStageChange(newStage);
  };

  return (
    <div className="space-y-4">
      {/* 1. QUICK CONTEXT CARDS - Most important info first */}
      
      {/* Watch Out For Section - PROMOTED to top */}
      {recruitDetails?.watch_out_notes && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>Watch Out For</span>
            </div>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-6 px-2 text-xs"
              onClick={() => setEditDrawerOpen(true)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {recruitDetails.watch_out_notes}
          </p>
        </div>
      )}

      {/* Significant Other - shown if there's a name */}
      {recruitDetails?.significant_other_name && (
        <div className="bg-muted/50 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Heart className="h-3.5 w-3.5" />
            <span>Significant Other</span>
          </div>
          <p className="font-medium">{recruitDetails.significant_other_name}</p>
        </div>
      )}

      {/* Their Why - Purpose Statement */}
      <PurposeDisplayCard
        purposeStatement={purposeStatement}
        purposeUpdatedAt={purposeUpdatedAt}
      />
      
      {/* 2. BLITZ STATUS - Consolidated Card */}
      <BlitzStatusCard 
        recruit={recruit}
        recruitRepData={recruitRepData}
        queryClient={queryClient}
      />
      
      {/* 3. STAGE SELECTOR */}
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
              const earlyStagesList = ['100 List', 'Reached Out', 'Evaluating'];
              const isEarlyStageOption = earlyStagesList.includes(stage);
              const allowedForEarlyStage = [...earlyStagesList, 'Signed'].includes(stage);
              const isBackwardMove = isEarlyStageOption && !isEarlyStage;
              
              const isDisabled = stageLocked && 
                stage !== recruit.stage && 
                !isBackwardMove && 
                !(isEarlyStage && allowedForEarlyStage);
              
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
            
            <SelectSeparator className="my-1" />
            
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
      
      {/* 4. ACTIONS */}
      <div className="flex gap-2">
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditDrawerOpen(true)}
            className="flex-1"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit Details
          </Button>
        )}
        
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
      
      {/* 5. BLITZ HISTORY - Collapsed by default */}
      <BlitzCommitmentsSection 
        recruit={recruit}
        recruitRepData={recruitRepData}
        queryClient={queryClient}
      />

      {/* 6. ROLE MANAGEMENT - Show if recruit has a role */}
      {recruitRole && canEditRole && (
        <div className="bg-muted/50 border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Assigned Role</p>
              <p className="font-semibold text-sm">{getRoleLabel((recruitRole as any).role as AccessLevel)}</p>
            </div>
            {!editingRole ? (
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => { setEditingRole(true); setNewRole((recruitRole as any).role); }}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setShowRoleRemoveConfirm(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => { setEditingRole(false); setNewRole(''); }}>
                Cancel
              </Button>
            )}
          </div>
          {editingRole && (
            <div className="mt-3 space-y-2">
              <Select value={newRole || "__none__"} onValueChange={(v) => setNewRole(v === "__none__" ? "" : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No role (regular rep)</SelectItem>
                  {editableRoles.map((role) => (
                    <SelectItem key={role} value={role}>{getRoleLabel(role)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {roleJumpInfo?.isLargeJump && newRole && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ This role is {roleJumpInfo.levelDiff} levels above yours
                </p>
              )}
              <Button 
                size="sm" 
                className="w-full"
                disabled={!newRole || newRole === (recruitRole as any).role || updateRoleMutation.isPending}
                onClick={() => {
                  if (!newRole) return;
                  if (newRole !== (recruitRole as any).role) setShowRoleChangeConfirm(true);
                }}
              >
                {updateRoleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Role'}
              </Button>
            </div>
          )}
        </div>
      )}
      
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

      {/* Role Change Confirmation */}
      <AlertDialog open={showRoleChangeConfirm} onOpenChange={setShowRoleChangeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {roleJumpInfo?.isLargeJump && <AlertTriangle className="h-5 w-5 text-amber-500" />}
              Change Role
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <p>
                Change <strong>{recruit.name}</strong>'s role from{' '}
                <strong>{getRoleLabel((recruitRole as any)?.role as AccessLevel)}</strong> to{' '}
                <strong>{getRoleLabel(newRole as AccessLevel)}</strong>?
              </p>
              {roleJumpInfo?.isLargeJump && (
                <p className="text-amber-600 dark:text-amber-400 font-medium">
                  ⚠️ This role is {roleJumpInfo.levelDiff} levels above yours — double-check this is correct.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRoleChangeConfirm}>
              Yes, Change Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Role Remove Confirmation */}
      <AlertDialog open={showRoleRemoveConfirm} onOpenChange={setShowRoleRemoveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Role</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{recruit.name}</strong>'s{' '}
              <strong>{getRoleLabel((recruitRole as any)?.role as AccessLevel)}</strong> role? They'll become a regular rep with no management access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRoleRemoveConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Consolidated Blitz Status Card - replaces IpadAssignmentCard + BlitzReadinessWarnings
const BlitzStatusCard = ({ 
  recruit, 
  recruitRepData,
  queryClient 
}: { 
  recruit: Recruit;
  recruitRepData: RecruitRepData | null;
  queryClient: any;
}) => {
  const { allBlitzes } = useBlitzes();
  const isRookie = recruitRepData && (recruitRepData.year === 'Rookie' || !recruitRepData.year);
  
  // Check if recruit is in a stage where blitz matters (Signed+)
  const stageLower = (recruit.stage || '').toLowerCase();
  const earlyStages = ['100_list', '100 list', 'evaluating', 'reached_out', 'reached out'];
  const exitStages = ['not interested', 'potential follow up', 'signed but not interested'];
  const isEarlyStage = earlyStages.some(s => stageLower.includes(s));
  const isExitStage = exitStages.some(s => stageLower.includes(s));
  const isSignedOrBeyond = !isEarlyStage && !isExitStage;
  
  // Calculate closest upcoming blitz from committed blitzes
  // IMPORTANT: All useMemo hooks MUST be called before any conditional returns
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
    
    return { ...closest, daysUntil };
  }, [recruitRepData?.committed_blitzes, allBlitzes]);

  // Check for past blitzes (blitzes where end_date is in the past)
  // IMPORTANT: This useMemo MUST be called before any conditional returns
  const hasPastBlitz = useMemo(() => {
    if (!recruitRepData?.committed_blitzes || !allBlitzes.length) return false;
    
    const committedIds = (recruitRepData.committed_blitzes as (string | { id: string })[])
      .map(b => typeof b === 'string' ? b : (b as { id: string })?.id);
    
    if (committedIds.length === 0) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find if any committed blitz has ended
    return allBlitzes
      .filter(blitz => committedIds.includes(blitz.id))
      .some(blitz => {
        const endDate = blitz.endDate ? parseDateAsLocal(blitz.endDate) : parseDateAsLocal(blitz.date);
        return endDate && endDate < today;
      });
  }, [recruitRepData?.committed_blitzes, allBlitzes]);
  
  // Only show for Signed+ rookies - AFTER all hooks are called
  if (!isRookie || !isSignedOrBeyond) return null;
  
  const hasIpad = recruitRepData?.ipad_assigned ?? false;
  const isRampComplete = recruitRepData?.ramp_phase_4_complete === true;
  const currentPhase = [
    recruitRepData?.ramp_phase_1_complete,
    recruitRepData?.ramp_phase_2_complete,
    recruitRepData?.ramp_phase_3_complete,
    recruitRepData?.ramp_phase_4_complete,
  ].filter(Boolean).length;
  
  const isReady = hasIpad && isRampComplete;
  const hasBlitzCommitment = closestBlitz !== null;
  const isBlitzApproaching = hasBlitzCommitment && closestBlitz.daysUntil <= 21;
  
  // Don't show card if they're already ready and no upcoming blitz
  if (isReady && !hasBlitzCommitment) return null;
  
  const handleToggleIpad = async (checked: boolean) => {
    const queryKey = ['recruit-rep-data', recruit.id, recruit.email, recruit.name];
    
    queryClient.setQueryData(queryKey, (old: any) => 
      old ? { ...old, ipad_assigned: checked } : old
    );
    
    try {
      const { error: supabaseError } = await supabase
        .from('reps')
        .update({ ipad_assigned: checked })
        .eq('id', recruit.id);
      
      if (supabaseError) throw supabaseError;
      
      const { session } = await getSessionFast();
      if (session) {
        await supabase.functions.invoke('update-rookie-status', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { rookieId: recruit.id, ipadAssigned: checked },
        });
      }
      
      toast.success(checked ? 'iPad assigned' : 'iPad unassigned');
      queryClient.invalidateQueries({ queryKey: ['recruit-rep-data', recruit.id], exact: false });
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
    } catch (error) {
      queryClient.setQueryData(queryKey, (old: any) => 
        old ? { ...old, ipad_assigned: !checked } : old
      );
      toast.error("Couldn't update iPad status");
    }
  };
  
  // Show progress section if ramp complete OR has past blitz (not requiring both)
  // This ensures we show preseason progress even for recruits who shadowed but haven't been on a blitz yet
  const showProgressSection = hasPastBlitz || isRampComplete;

  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-3",
      showProgressSection 
        ? "bg-primary/5 border-primary/20"
        : !isReady && isBlitzApproaching 
          ? "bg-destructive/5 border-destructive/30" 
          : "bg-muted/50 border-border"
    )}>
      {/* Progress section: Show for ramp complete OR past blitz */}
      {showProgressSection && !hasBlitzCommitment && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">
              {hasPastBlitz ? 'Post-Blitz Progress' : 'Preseason Progress'}
            </span>
          </div>
          {hasPastBlitz && (
            <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-600 text-xs">
              Blitz Complete ✓
            </Badge>
          )}
        </div>
      )}
      
      {/* Next Blitz Header - only show if upcoming blitz */}
      {hasBlitzCommitment && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plane className={cn("h-4 w-4", !isReady && isBlitzApproaching ? "text-destructive" : "text-primary")} />
            <span className="font-medium text-sm">{closestBlitz.name}</span>
          </div>
          <Badge variant={isReady ? "secondary" : isBlitzApproaching ? "destructive" : "secondary"} className="text-xs">
            {formatDaysUntilBlitz(closestBlitz.daysUntil)}
          </Badge>
        </div>
      )}
      
      {/* Readiness Checklist - only show if not in progress view without upcoming blitz */}
      {(!showProgressSection || hasBlitzCommitment) && (
        <div className="flex flex-wrap gap-2">
          <div className={cn(
            "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full",
            hasIpad ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
          )}>
            {hasIpad ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            <span>iPad</span>
          </div>
          <div className={cn(
            "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full",
            isRampComplete ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
          )}>
            {isRampComplete ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            <span>Phase {currentPhase}/4</span>
          </div>
        </div>
      )}
      
      {/* Actions row - only show if not ready and has upcoming blitz */}
      {!isReady && (!showProgressSection || hasBlitzCommitment) && (
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Tablet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">iPad</span>
            </div>
            <Switch
              checked={hasIpad}
              onCheckedChange={handleToggleIpad}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Blitz Commitments Section (Collapsed)
const BlitzCommitmentsSection = ({ 
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
  
  // Fetch committed blitzes from recruit_blitzes table
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
    staleTime: 5000,
  });
  
  // Extract committed blitz data
  const committedBlitzData = useMemo(() => {
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
    
    if (recruitBlitzesData.length > 0) {
      return { ids: recruitBlitzesData, names: [] as string[] };
    }
    
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
  
  const isBlitzCommitted = useCallback((blitz: { id: string; name: string }) => {
    return committedBlitzData.ids.includes(blitz.id) || 
           committedBlitzData.names.includes(blitz.name.toLowerCase().trim());
  }, [committedBlitzData]);
  
  const committedBlitzIds = committedBlitzData.ids;
  
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
    
    queryClient.setQueryData(['recruit-rep-data', recruit.id, recruit.email, recruit.name], (old: any) => 
      old ? { ...old, committed_blitzes: newCommittedBlitzIds } : old
    );
    queryClient.setQueryData(['recruit-blitzes-commitments', recruit.id], newCommittedBlitzIds);
    
    try {
      const { session } = await getSessionFast();
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
      if (!isCurrentlyCommitted) {
        queryClient.invalidateQueries({ queryKey: ['recruit-declined-blitzes', recruit.id] });
      }
    } catch (error) {
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
              <History className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">Blitz History</p>
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
