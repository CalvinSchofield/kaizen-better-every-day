import { useState, useMemo, useEffect } from "react";
import { Recruit, RecruitActivity, useUpdateRecruitStage, useLogRecruitActivity, useUpdateRecruitActivity, useDeleteRecruitActivity } from "@/hooks/useGroupRecruits";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAutoStageProgression } from "@/hooks/useAutoStageProgression";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { differenceInDays, parseISO, format } from "date-fns";
import { AlertCircle, TrendingUp, Clock, Settings, UserCircle, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

import { TabType, RecruitRepData, RecruitGoals, ContactForHelp, RecruitSummerConfig } from "./types";
import { stripEmojis, getFirstName, getStageDescription, getOnboardingStepDescription } from "./utils";
import { generateStageHelpMessage } from "@/utils/stageSpecificHelpMessage";
import { RecruitHeader } from "./RecruitHeader";
import { QuickActionsBar } from "./QuickActionsBar";
import { FocusCard } from "./FocusCard";
import { ProgressTab } from "./tabs/ProgressTab";
import { ActivityTab } from "./tabs/ActivityTab";
import { DetailsTab } from "./tabs/DetailsTab";
import { PhaseVerificationDrawer } from "../PhaseVerificationDrawer";
import { ScheduledActivityActionSheet } from "../ScheduledActivityActionSheet";
import { ScheduleFollowUpDrawer } from "../ScheduleFollowUpDrawer";
import { PostContactDrawer } from "../PostContactDrawer";

// Import all the dialog components from the original file
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { 
  Phone, MessageSquare, Calendar, PhoneCall, PhoneMissed, Users, Trash2
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const EXIT_STAGES = ['Not Interested', 'Signed but Not Interested', 'Potential Follow Up'];

interface RecruitDetailDrawerProps {
  recruit: Recruit | null;
  activities: RecruitActivity[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when recruit is moved to an exit stage (Not Interested, Signed but Not Interested) */
  onExitStage?: (recruitNotionId: string) => void;
}

export const RecruitDetailDrawer = ({ 
  recruit: recruitProp, 
  activities: initialActivities, 
  open, 
  onOpenChange,
  onExitStage 
}: RecruitDetailDrawerProps) => {
  // Determine default tab based on year and progress/stage
  const isRookie = recruitProp?.year === 'Rookie' || recruitProp?.year === '2025' || recruitProp?.year === '2026';
  const isVet = !isRookie && recruitProp?.year !== 'Sophomore'; // Vets never see progress tab by default
  const hasSold = recruitProp?.stage?.toLowerCase().includes('sold');
  const hasAllPhasesComplete = recruitProp?.phase4Complete === true;
  const isBlitzReady = recruitProp?.blitzReady === true;
  
  // Default to 'activity' for: vets, sold recruits, or rookies with all phases complete/blitz ready
  const shouldDefaultToActivity = isVet || hasSold || hasAllPhasesComplete || isBlitzReady;
  const defaultTab: TabType = shouldDefaultToActivity ? 'activity' : 'progress';
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  
  // Reset tab when drawer opens with a different recruit
  useEffect(() => {
    if (open && recruitProp) {
      const newDefault: TabType = shouldDefaultToActivity ? 'activity' : 'progress';
      setActiveTab(newDefault);
    }
  }, [open, recruitProp?.id, shouldDefaultToActivity]);
  
  // Dialog states
  const [logActivityOpen, setLogActivityOpen] = useState(false);
  const [isDirectSchedule, setIsDirectSchedule] = useState(false);
  const [scheduleFollowUpDrawerOpen, setScheduleFollowUpDrawerOpen] = useState(false);
  const [editActivityOpen, setEditActivityOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [phoneEntryOpen, setPhoneEntryOpen] = useState(false);
  const [potentialFollowUpOpen, setPotentialFollowUpOpen] = useState(false);
  const [list100ConnectedOpen, setList100ConnectedOpen] = useState(false);
  const [postContactOpen, setPostContactOpen] = useState(false);
  const [postContactMethod, setPostContactMethod] = useState<'call' | 'text' | 'in_person'>('call');
  const [followUpNextStep, setFollowUpNextStep] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<RecruitActivity | null>(null);
  const [activityType, setActivityType] = useState<'phone_call' | 'in_person' | 'note' | 'next_step'>('phone_call');
  const [activityNotes, setActivityNotes] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextActionDue, setNextActionDue] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editAssignee, setEditAssignee] = useState<string | null>(null);
  const [editDatePopoverOpen, setEditDatePopoverOpen] = useState(false);
  const [pendingPhoneAction, setPendingPhoneAction] = useState<'ask_help' | 'call' | 'text' | null>(null);
  const [phoneEntryTarget, setPhoneEntryTarget] = useState<'recruit' | 'contact'>('contact');
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [stageConfirmOpen, setStageConfirmOpen] = useState(false);
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [onboardingConfirmOpen, setOnboardingConfirmOpen] = useState(false);
  const [pendingOnboardingStep, setPendingOnboardingStep] = useState<{ field: string; label: string; value: boolean } | null>(null);
  const [phaseVerificationOpen, setPhaseVerificationOpen] = useState(false);
  const [pendingPhaseVerification, setPendingPhaseVerification] = useState<{ phase: number; field: string; isUndo: boolean } | null>(null);
  const [isPhaseVerifying, setIsPhaseVerifying] = useState(false);
  const [hasPhaseError, setHasPhaseError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [stageShake, setStageShake] = useState(false);
  const [activityShake, setActivityShake] = useState(false);
  const [scheduledActionSheetOpen, setScheduledActionSheetOpen] = useState(false);
  const [scheduledActivityForAction, setScheduledActivityForAction] = useState<RecruitActivity | null>(null);

  const updateStageMutation = useUpdateRecruitStage();
  const logActivityMutation = useLogRecruitActivity();
  const updateActivityMutation = useUpdateRecruitActivity();
  const deleteActivityMutation = useDeleteRecruitActivity();
  const { data: teamAccess } = useTeamAccess();
  const { data: assignableUsers = [] } = useAssignableUsers({ 
    recruitId: recruitProp?.id,
    recruitTeamLeader: recruitProp?.teamName 
  });
  const queryClient = useQueryClient();
  const { checkAndUpdateStage } = useAutoStageProgression();

  // Live recruit data
  const { data: liveRecruit } = useQuery({
    queryKey: ['recruit-detail-live', recruitProp?.id],
    queryFn: () => {
      const cachedQueries = queryClient.getQueriesData<{ recruits: Recruit[] }>({ queryKey: ['group-recruits'] });
      for (const [, data] of cachedQueries) {
        const fromCache = data?.recruits?.find(r => r.id === recruitProp?.id);
        if (fromCache) return fromCache;
      }
      return recruitProp;
    },
    enabled: !!recruitProp?.id && open,
    staleTime: 0,
    refetchInterval: open ? 1000 : false,
  });
  
  const recruit = liveRecruit || recruitProp;

  // Live activities
  const { data: liveActivities } = useQuery({
    queryKey: ['recruit-activities', recruit?.id],
    queryFn: async () => {
      if (!recruit?.id) return [];
      const { data } = await supabase
        .from('recruit_activities')
        .select('*')
        .eq('recruit_id', recruit.id)
        .order('created_at', { ascending: false })
        .limit(50);
      return (data || []) as RecruitActivity[];
    },
    enabled: !!recruit?.id && open,
    staleTime: 0,
  });

  const activities = liveActivities ?? initialActivities;

  useEffect(() => {
    if (open && recruit) {
      checkAndUpdateStage(recruit.id, recruit.stage, true);
    }
  }, [open, recruit?.id, recruit?.stage, checkAndUpdateStage]);

  // Current user rep
  const { data: currentUserRep } = useQuery({
    queryKey: ['current-user-rep-for-drawer'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('reps').select('id, name, team_leader, recruiter').eq('user_id', user.id).maybeSingle();
      return data;
    },
  });

  // Contact for help - find the recruit's leader/recruiter to text (but NOT if current user IS that person)
  const { data: contactForHelp } = useQuery({
    queryKey: ['contact-for-help', recruit?.recruiterName, recruit?.teamName, currentUserRep?.name, teamAccess?.accessLevel],
    queryFn: async () => {
      if (!recruit) return null;
      const accessLevel = teamAccess?.accessLevel;
      const isLeaderOfLeaders = accessLevel === 'mgmt_group_lead' || accessLevel === 'area_director';
      const currentUserName = stripEmojis(currentUserRep?.name || '')?.toLowerCase()?.trim();
      
      // For leader-of-leaders, contact the team leader; otherwise contact the recruiter
      let searchName = isLeaderOfLeaders ? recruit.teamName : recruit.recruiterName;
      const role = isLeaderOfLeaders ? 'leader' : 'recruiter';
      
      if (!searchName) return null;
      
      const cleanedSearchName = stripEmojis(searchName)?.toLowerCase()?.trim();
      
      // Don't show button if current user IS the recruiter or team leader
      const cleanedRecruiterName = stripEmojis(recruit.recruiterName || '')?.toLowerCase()?.trim();
      const cleanedTeamLeaderName = stripEmojis(recruit.teamName || '')?.toLowerCase()?.trim();
      
      // If current user is either the recruiter or team leader of this recruit, don't show the button
      if (currentUserName && (currentUserName === cleanedRecruiterName || currentUserName === cleanedTeamLeaderName)) {
        return null;
      }
      
      const { data: repData } = await supabase.from('reps').select('id, name, phone').ilike('name', `%${stripEmojis(searchName)}%`).maybeSingle();
      if (!repData) return null;
      return { name: getFirstName(repData.name), phone: repData.phone, id: repData.id, role } as ContactForHelp;
    },
    enabled: !!recruit && !!teamAccess && !!currentUserRep,
    staleTime: 5 * 60 * 1000,
  });

  const isLeaderOfLeaders = teamAccess?.accessLevel === 'mgmt_group_lead' || teamAccess?.accessLevel === 'area_director';

  // Recruit rep data - match by email first, then by name for ghost reps
  const { data: recruitRepData } = useQuery({
    queryKey: ['recruit-rep-data', recruit?.id, recruit?.email, recruit?.name],
    queryFn: async () => {
      if (!recruit) return null;
      // Try matching by email first (most reliable linkage)
      if (recruit.email) {
        const { data } = await supabase.from('reps').select('*').ilike('email', recruit.email).maybeSingle();
        if (data) return data as RecruitRepData | null;
      }
      // Try matching by name for ghost reps without email
      if (recruit.name) {
        const { data } = await supabase.from('reps').select('*').eq('name', recruit.name).maybeSingle();
        if (data) return data as RecruitRepData | null;
      }
      // Fallback to id match (works when recruit.id IS the rep id)
      const { data } = await supabase.from('reps').select('*').eq('id', recruit.id).maybeSingle();
      return data as RecruitRepData | null;
    },
    enabled: !!recruit?.id && open,
  });

  // Recruit goals
  const { data: recruitGoals } = useQuery({
    queryKey: ['recruit-goals', recruitRepData?.user_id],
    queryFn: async () => {
      if (!recruitRepData?.user_id) return null;
      const { data } = await supabase.from('rep_goals').select('*').eq('user_id', recruitRepData.user_id).maybeSingle();
      return data as RecruitGoals | null;
    },
    enabled: !!recruitRepData?.user_id && open,
  });

  // YTD FP+
  const { data: recruitYtdFP = 0 } = useQuery({
    queryKey: ['recruit-ytd-fp', recruitRepData?.user_id],
    queryFn: async () => {
      if (!recruitRepData?.user_id) return 0;
      const { data } = await supabase.from('daily_entries').select('fp_plus').eq('user_id', recruitRepData.user_id).eq('is_finalized', true);
      return data?.reduce((sum, entry) => sum + (entry.fp_plus || 0), 0) || 0;
    },
    enabled: !!recruitRepData?.user_id && open,
  });

  // Summer config for recruit
  const { data: recruitSummerConfig } = useQuery({
    queryKey: ['recruit-summer-config', recruitRepData?.user_id],
    queryFn: async () => {
      if (!recruitRepData?.user_id) return null;
      const { data } = await supabase
        .from('season_config')
        .select('personal_summer_start, personal_summer_end, excluded_summer_days')
        .eq('user_id', recruitRepData.user_id)
        .maybeSingle();
      if (!data) return null;
      return {
        personalSummerStart: data.personal_summer_start,
        personalSummerEnd: data.personal_summer_end,
        excludedSummerDays: data.excluded_summer_days || [],
      } as RecruitSummerConfig;
    },
    enabled: !!recruitRepData?.user_id && open,
  });

  // Summer entries for recruit (used when in summer mode)
  const { data: recruitSummerEntries = [] } = useQuery({
    queryKey: ['recruit-summer-entries', recruitRepData?.user_id, recruitSummerConfig?.personalSummerStart],
    queryFn: async () => {
      if (!recruitRepData?.user_id || !recruitSummerConfig?.personalSummerStart) return [];
      const { data } = await supabase
        .from('daily_entries')
        .select('entry_date, fp_plus, work_start_time, work_end_time, doors_knocked, is_finalized')
        .eq('user_id', recruitRepData.user_id)
        .gte('entry_date', recruitSummerConfig.personalSummerStart)
        .order('entry_date', { ascending: false });
      return data || [];
    },
    enabled: !!recruitRepData?.user_id && !!recruitSummerConfig?.personalSummerStart && open,
  });

  // Help message - stage-specific
  const helpMessage = useMemo(() => {
    if (!recruit || !contactForHelp) return '';
    const recruitFirstName = getFirstName(recruit.name);
    return generateStageHelpMessage(recruitFirstName, recruit.stage, contactForHelp.role);
  }, [recruit, contactForHelp]);

  // Save phone mutation
  const savePhoneMutation = useMutation({
    mutationFn: async ({ repId, phone }: { repId: string; phone: string }) => {
      const { error } = await supabase.from('reps').update({ phone }).eq('id', repId);
      if (error) throw error;
      return { phone };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-for-help'] });
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      toast.success('Phone number saved');
    },
    onError: () => toast.error("Couldn't save phone number"),
  });

  if (!recruit) return null;

  const recruitFirstName = getFirstName(recruit.name);

  // Handlers
  const handleCall = async () => {
    if (!recruit.phone) {
      setPendingPhoneAction('call');
      setPhoneEntryTarget('recruit');
      setPhoneEntryOpen(true);
      return;
    }
    window.location.href = `tel:${recruit.phone}`;
    setTimeout(() => { 
      setPostContactMethod('call');
      setPostContactOpen(true); 
    }, 500);
  };

  const handleText = async () => {
    if (!recruit.phone) {
      setPendingPhoneAction('text');
      setPhoneEntryTarget('recruit');
      setPhoneEntryOpen(true);
      return;
    }

    const normalizePhoneForSms = (raw: string) => raw.trim().replace(/[^\d+]/g, '');

    const recruitPhone = normalizePhoneForSms(recruit.phone);

    // Look up the team leader's phone using the recruit's team_id for reliable lookup
    let leaderPhone: string | null = null;

    // First try using contactForHelp if it's the leader
    if (contactForHelp?.role === 'leader' && contactForHelp.phone) {
      leaderPhone = normalizePhoneForSms(contactForHelp.phone);
    } else if (recruit.teamId) {
      // Use team_id to find the team's lead_user_id, then get their phone
      const { data: teamData } = await supabase
        .from('teams')
        .select('lead_user_id')
        .eq('id', recruit.teamId)
        .maybeSingle();

      if (teamData?.lead_user_id) {
        const { data: leaderRep } = await supabase
          .from('reps')
          .select('phone')
          .eq('user_id', teamData.lead_user_id)
          .maybeSingle();

        if (leaderRep?.phone) {
          leaderPhone = normalizePhoneForSms(leaderRep.phone);
        }
      }
    }

    if (leaderPhone && leaderPhone !== recruitPhone) {
      logActivityMutation.mutate({
        recruitId: recruit.id,
        recruitNotionId: recruit.id,
        activityType: 'phone_call',
        notes: 'Text sent (group with leader)',
        updateLastContact: true,
      });
      toast.success('Group text logged');

      // Multi-recipient SMS separator is inconsistent across devices; "," works on iOS
      window.location.href = `sms:${recruitPhone},${leaderPhone}`;
      return;
    }

    logActivityMutation.mutate({
      recruitId: recruit.id,
      recruitNotionId: recruit.id,
      activityType: 'phone_call',
      notes: 'Text sent',
      updateLastContact: true,
    });
    toast.success('Text logged');
    window.location.href = `sms:${recruitPhone}`;
  };

  const handleAskForHelp = () => {
    if (!contactForHelp?.phone) {
      setPendingPhoneAction('ask_help');
      setPhoneEntryTarget('contact');
      setPhoneEntryOpen(true);
      return;
    }
    window.location.href = `sms:${contactForHelp.phone}?body=${encodeURIComponent(helpMessage)}`;
  };

  const handleStageChange = (newStage: string) => {
    setPendingStage(newStage);
    if (newStage === 'Potential Follow Up') {
      // For Potential Follow Up, open the follow-up scheduling drawer
      setPotentialFollowUpOpen(true);
    } else {
      // For other stages, show confirmation
      setStageConfirmOpen(true);
    }
  };

  const handleConfirmStageChange = () => {
    if (!pendingStage) return;
    const isExitStage = EXIT_STAGES.includes(pendingStage);
    updateStageMutation.mutate({ recruitId: recruit.id, recruitNotionId: recruit.id, newStage: pendingStage }, {
      onSuccess: () => { 
        toast.success(`Moved to ${pendingStage}`); 
        setStageConfirmOpen(false); 
        setPendingStage(null);
        // For exit stages, notify parent to dismiss the card
        if (isExitStage && onExitStage) {
          onExitStage(recruit.id);
        }
      },
      onError: () => { toast.error("Couldn't update stage"); setStageShake(true); setTimeout(() => setStageShake(false), 500); setStageConfirmOpen(false); setPendingStage(null); }
    });
  };

  // Handle Potential Follow Up confirmation with scheduled date
  const handleConfirmPotentialFollowUp = () => {
    if (!followUpDate) {
      toast.error('Please select a follow-up date');
      return;
    }
    
    updateStageMutation.mutate({ recruitId: recruit.id, recruitNotionId: recruit.id, newStage: 'Potential Follow Up' }, {
      onSuccess: () => {
        // Log the scheduled follow-up activity
        logActivityMutation.mutate({
          recruitId: recruit.id,
          recruitNotionId: recruit.id,
          activityType: 'next_step',
          notes: followUpNextStep || 'Scheduled follow-up',
          nextAction: followUpNextStep || 'Follow up',
          nextActionDue: followUpDate,
          updateLastContact: false,
        }, {
          onSuccess: () => {
            toast.success('Moved to Potential Follow Up with scheduled date');
            setPotentialFollowUpOpen(false);
            setPendingStage(null);
            setFollowUpDate('');
            setFollowUpNextStep('');
            // Notify parent to dismiss the card
            if (onExitStage) {
              onExitStage(recruit.id);
            }
          },
          onError: (err) => {
            console.error('Failed to log follow-up activity:', err);
            toast.error("Couldn't schedule follow-up");
          }
        });
      },
      onError: () => { 
        toast.error("Couldn't update stage"); 
        setStageShake(true); 
        setTimeout(() => setStageShake(false), 500); 
      }
    });
  };

  const handleOnboardingStepClick = (field: string, label: string, currentValue: boolean) => {
    // For ramp phases, show the phase verification drawer (both for completing and undoing)
    const rampPhaseFields = ['ramp_phase_1_complete', 'ramp_phase_2_complete', 'ramp_phase_3_complete', 'ramp_phase_4_complete'];
    const isRampPhase = rampPhaseFields.includes(field);
    
    if (isRampPhase) {
      const phaseNum = parseInt(field.replace('ramp_phase_', '').replace('_complete', ''));
      const isUndo = currentValue; // If current is true, clicking will undo it
      setPendingPhaseVerification({ phase: phaseNum, field, isUndo });
      setPhaseVerificationOpen(true);
    } else {
      // For basic onboarding steps, use simple confirmation
      setPendingOnboardingStep({ field, label, value: !currentValue });
      setOnboardingConfirmOpen(true);
    }
  };

  const handleConfirmPhaseVerification = async () => {
    if (!pendingPhaseVerification || !recruitRepData || !recruit) return;
    setIsPhaseVerifying(true);
    setHasPhaseError(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const phaseParams: Record<string, boolean> = {};
      phaseParams[`rampPhase${pendingPhaseVerification.phase}Complete`] = true;

      // Use recruitRepData.id (the reps table id) since backend function updates reps table
      const { error } = await supabase.functions.invoke('update-rookie-status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          rookieId: recruitRepData.id,
          ...phaseParams
        }
      });

      if (error) throw error;

      toast.success(`Phase ${pendingPhaseVerification.phase} verified!`);

      setPhaseVerificationOpen(false);
      setPendingPhaseVerification(null);
      setHasPhaseError(false);
      queryClient.invalidateQueries({ queryKey: ['group-recruits'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['recruit-rep-data'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['recruits-rep-data'], exact: false });
    } catch (error: any) {
      console.error('Error confirming phase:', error);
      setHasPhaseError(true);
      // Don't close the drawer so user can retry
    } finally {
      setIsPhaseVerifying(false);
    }
  };

  const handleUndoPhaseVerification = async () => {
    if (!pendingPhaseVerification || !recruitRepData || !recruit) return;
    setIsPhaseVerifying(true);
    setHasPhaseError(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Undo this phase and all phases after it
      const phaseParams: Record<string, boolean> = {};
      for (let i = pendingPhaseVerification.phase; i <= 4; i++) {
        phaseParams[`rampPhase${i}Complete`] = false;
      }

      // Use recruitRepData.id (the reps table id) since backend function updates reps table
      const { error } = await supabase.functions.invoke('update-rookie-status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          rookieId: recruitRepData.id,
          ...phaseParams
        }
      });

      if (error) throw error;

      toast.success(`Phase ${pendingPhaseVerification.phase} undone`);

      setPhaseVerificationOpen(false);
      setPendingPhaseVerification(null);
      setHasPhaseError(false);
      queryClient.invalidateQueries({ queryKey: ['group-recruits'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['recruit-rep-data'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['recruits-rep-data'], exact: false });
    } catch (error: any) {
      console.error('Error undoing phase:', error);
      setHasPhaseError(true);
    } finally {
      setIsPhaseVerifying(false);
    }
  };

  const handleConfirmOnboardingChange = async () => {
    if (!pendingOnboardingStep || !recruitRepData || !recruit) return;
    const { field, value } = pendingOnboardingStep;

    const recruitRepQueryKey = ['recruit-rep-data', recruit?.id, recruit?.email, recruit?.name] as const;

    // Define step order for cascading complete/uncomplete
    const allStepsOrder = [
      'onboarding_complete', 'trainings_complete', 'slack_joined',
      'ramp_phase_1_complete', 'ramp_phase_2_complete', 'ramp_phase_3_complete', 'ramp_phase_4_complete'
    ];

    const fieldToNotionStatus: Record<string, string> = {
      'onboarding_complete': 'Onboarding ✅', 'trainings_complete': 'Required Trainings ✅', 'slack_joined': 'Slack ✅',
      'ramp_phase_1_complete': 'Phase 1 ✅', 'ramp_phase_2_complete': 'Phase 2 ✅', 'ramp_phase_3_complete': 'Phase 3 ✅', 'ramp_phase_4_complete': 'Phase 4 ✅',
    };
    const fieldToEdgeFunctionParam: Record<string, string> = {
      'ramp_phase_1_complete': 'rampPhase1Complete', 'ramp_phase_2_complete': 'rampPhase2Complete',
      'ramp_phase_3_complete': 'rampPhase3Complete', 'ramp_phase_4_complete': 'rampPhase4Complete',
    };

    // Build updates object
    // If completing a step, also complete all PREVIOUS steps (sequential requirement)
    // If uncompleting a step, also uncomplete all SUBSEQUENT steps
    const updates: Record<string, boolean> = { [field]: value };
    const fieldIndex = allStepsOrder.indexOf(field);

    if (value) {
      // Completing: mark all previous steps as complete too
      allStepsOrder.slice(0, fieldIndex).forEach(prevField => {
        if (!recruitRepData[prevField as keyof typeof recruitRepData]) {
          updates[prevField] = true;
        }
      });
    } else {
      // Uncompleting: mark all subsequent steps as incomplete too
      allStepsOrder.slice(fieldIndex + 1).forEach(subsequentField => {
        if (recruitRepData[subsequentField as keyof typeof recruitRepData]) {
          updates[subsequentField] = false;
        }
      });
    }

    // Optimistic update
    queryClient.setQueryData(recruitRepQueryKey, (old: any) => old ? { ...old, ...updates } : old);
    setOnboardingConfirmOpen(false);
    setPendingOnboardingStep(null);
    try {
      // Leaders/recruiters can't directly update the reps row due to RLS; use backend function so it persists.
      const finalState: any = { ...recruitRepData, ...updates };

      let computedOnboardingStatus = 'Not started';
      if (finalState.ramp_phase_4_complete) computedOnboardingStatus = 'Phase 4 ✅';
      else if (finalState.ramp_phase_3_complete) computedOnboardingStatus = 'Phase 3 ✅';
      else if (finalState.ramp_phase_2_complete) computedOnboardingStatus = 'Phase 2 ✅';
      else if (finalState.ramp_phase_1_complete) computedOnboardingStatus = 'Phase 1 ✅';
      else if (finalState.slack_joined) computedOnboardingStatus = 'Slack ✅';
      else if (finalState.trainings_complete) computedOnboardingStatus = 'Required Trainings ✅';
      else if (finalState.onboarding_complete) computedOnboardingStatus = 'Onboarding ✅';

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('update-rookie-status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          rookieId: recruitRepData.id,
          onboardingStatus: computedOnboardingStatus,
        },
      });
      if (error) throw error;

      const uncompleteCount = Object.keys(updates).length;
      toast.success(value ? 'Marked complete' : uncompleteCount > 1 ? `Unmarked ${uncompleteCount} steps` : 'Marked incomplete');

      queryClient.invalidateQueries({ queryKey: ['group-recruits'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['recruit-rep-data'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['recruits-rep-data'], exact: false });

      if (value && field === 'onboarding_complete') await checkAndUpdateStage(recruit.id, recruit.stage);
    } catch (error) {
      // Rollback optimistic update
      const rollback = Object.fromEntries(Object.keys(updates).map(k => [k, !updates[k]]));
      queryClient.setQueryData(recruitRepQueryKey, (old: any) => old ? { ...old, ...rollback } : old);
      toast.error("Couldn't update");
    }
  };

  const handleLogActivity = () => {
    setIsDirectSchedule(false);
    setActivityType('phone_call');
    setActivityNotes('');
    setLogActivityOpen(true);
  };

  const handleScheduleFollowUp = () => {
    // Open the full ScheduleFollowUpDrawer with assign-to option
    setScheduleFollowUpDrawerOpen(true);
  };

  const handleActivityClick = (activity: RecruitActivity) => {
    // For scheduled activities (next_step), show the action sheet instead
    if (activity.activity_type === 'next_step') {
      setScheduledActivityForAction(activity);
      setScheduledActionSheetOpen(true);
      return;
    }
    
    // For other activities, open the edit drawer
    setSelectedActivity(activity);
    setEditNotes(activity.notes || '');
    setEditDate(format(parseISO(activity.created_at), 'yyyy-MM-dd'));
    setEditAssignee(activity.assigned_to_user_id || null);
    setEditActivityOpen(true);
  };

  // Handler for marking a scheduled activity as complete
  const handleMarkScheduledComplete = (activity: RecruitActivity, completedType: 'phone_call' | 'in_person') => {
    // Log the completed activity with the scheduled notes
    logActivityMutation.mutate({
      recruitId: recruit.id,
      recruitNotionId: recruit.id,
      activityType: completedType,
      notes: activity.notes || activity.next_action || 'Completed scheduled follow-up',
      updateLastContact: true,
    }, {
      onSuccess: () => {
        // Delete the scheduled activity after logging the completed one
        deleteActivityMutation.mutate(activity.id, {
          onSuccess: () => {
            toast.success('Marked complete!');
            queryClient.invalidateQueries({ queryKey: ['recruit-activities', recruit.id] });
          },
          onError: () => {
            // Still show success for the logged activity even if delete fails
            toast.success('Activity logged');
            queryClient.invalidateQueries({ queryKey: ['recruit-activities', recruit.id] });
          }
        });
      },
      onError: () => {
        toast.error("Couldn't log activity");
      }
    });
  };

  // Handler for rescheduling a scheduled activity
  const handleRescheduleActivity = (activity: RecruitActivity) => {
    // Open the schedule follow-up drawer with pre-filled data
    setActivityType('next_step');
    setActivityNotes(activity.notes || activity.next_action || '');
    setNextAction(activity.next_action || '');
    setNextActionDue(''); // Clear so they pick new date
    setIsDirectSchedule(true);
    setLogActivityOpen(true);
    
    // Delete the old scheduled activity
    deleteActivityMutation.mutate(activity.id, {
      onError: () => {
        // Silent fail - the new schedule will work anyway
        console.warn('Could not delete old scheduled activity');
      }
    });
  };

  // Handler for deleting a scheduled activity from the action sheet
  const handleDeleteScheduledActivity = (activity: RecruitActivity) => {
    setSelectedActivity(activity);
    setDeleteConfirmOpen(true);
  };

  const handleSaveActivity = () => {
    if (!activityNotes && activityType !== 'next_step') { toast.error('Please add notes'); return; }
    logActivityMutation.mutate({
      recruitId: recruit.id,
      recruitNotionId: recruit.id, 
      activityType, 
      notes: activityNotes,
      nextAction: activityType === 'next_step' ? nextAction : undefined,
      nextActionDue: activityType === 'next_step' ? nextActionDue : undefined,
      updateLastContact: activityType === 'phone_call' || activityType === 'in_person',
    }, {
      onSuccess: () => {
        toast.success('Activity logged');
        setLogActivityOpen(false);
        setActivityNotes(''); setNextAction(''); setNextActionDue('');
        // Invalidate both the activities query and the group-recruits query for full refresh
        queryClient.invalidateQueries({ queryKey: ['recruit-activities', recruit.id] });
        queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      },
      onError: () => { toast.error("Couldn't save activity"); setActivityShake(true); setTimeout(() => setActivityShake(false), 500); }
    });
  };

  const getActivityIcon = (type: string, notes?: string | null) => {
    const isText = notes?.toLowerCase().includes('text');
    if (type === 'phone_call') {
      if (isText) return <MessageSquare className="h-4 w-4 text-blue-500" />;
      if (notes?.includes('Connected')) return <PhoneCall className="h-4 w-4 text-green-500" />;
      if (notes === 'No Answer') return <PhoneMissed className="h-4 w-4 text-muted-foreground" />;
      return <Phone className="h-4 w-4" />;
    }
    if (type === 'in_person') return <Users className="h-4 w-4" />;
    return <MessageSquare className="h-4 w-4" />;
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90dvh]">
          <DrawerHeader className="pb-2">
            <RecruitHeader recruit={recruit} isLeaderOfLeaders={isLeaderOfLeaders} />
          </DrawerHeader>
          
          <div className="px-4 pb-4 overflow-y-auto">
            {/* Sticky Quick Actions */}
            <QuickActionsBar 
              onCall={handleCall}
              onText={handleText}
              onAskForHelp={handleAskForHelp}
              contactForHelp={contactForHelp || null}
            />
            
            {/* Smart Focus Card */}
            <div className="mt-4">
              <FocusCard 
                recruit={recruit}
                recruitRepData={recruitRepData || null}
                recruitGoals={recruitGoals || null}
                onNavigateToTab={setActiveTab}
              />
            </div>
            
            {/* Tabbed Content */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="mt-4">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="progress" className="text-xs gap-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Progress
                </TabsTrigger>
                <TabsTrigger value="activity" className="text-xs gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Activity
                </TabsTrigger>
                <TabsTrigger value="details" className="text-xs gap-1">
                  <Settings className="h-3.5 w-3.5" />
                  Details
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="progress" className="mt-4">
                <ProgressTab 
                  recruit={recruit}
                  recruitRepData={recruitRepData || null}
                  recruitGoals={recruitGoals || null}
                  recruitYtdFP={recruitYtdFP}
                  summerConfig={recruitSummerConfig}
                  summerEntries={recruitSummerEntries}
                  onOnboardingStepClick={handleOnboardingStepClick}
                />
              </TabsContent>
              
              <TabsContent value="activity" className="mt-4">
                <ActivityTab 
                  activities={activities}
                  onLogActivity={handleLogActivity}
                  onScheduleFollowUp={handleScheduleFollowUp}
                  onActivityClick={handleActivityClick}
                />
              </TabsContent>
              
              <TabsContent value="details" className="mt-4">
                <DetailsTab 
                  recruit={recruit}
                  recruitRepData={recruitRepData || null}
                  recruitYtdFP={recruitYtdFP}
                  onStageChange={handleStageChange}
                  stageShake={stageShake}
                  onDeleted={() => onOpenChange(false)}
                />
              </TabsContent>
            </Tabs>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Log Activity Drawer */}
      <Drawer open={logActivityOpen} onOpenChange={setLogActivityOpen}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader><DrawerTitle>{isDirectSchedule ? 'Schedule Follow-up' : 'Log Activity'}</DrawerTitle></DrawerHeader>
          <div className="p-4 space-y-4">
            {!isDirectSchedule && (
              <div className="grid grid-cols-3 gap-2">
                {(['phone_call', 'in_person', 'note'] as const).map((type) => (
                  <Button key={type} variant={activityType === type ? 'default' : 'outline'} size="sm" onClick={() => setActivityType(type)} className="flex-col h-auto py-2">
                    {getActivityIcon(type, null)}
                    <span className="text-xs mt-1 capitalize">{type.replace('_', ' ')}</span>
                  </Button>
                ))}
              </div>
            )}
            {activityType === 'next_step' ? (
              <>
                <div><Label>What's the next step?</Label><Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="e.g., Follow up" className="mt-1" /></div>
                <div><Label>Due Date</Label><Input type="date" value={nextActionDue} onChange={(e) => setNextActionDue(e.target.value)} className="mt-1" /></div>
              </>
            ) : (
              <div><Label>Notes</Label><Textarea value={activityNotes} onChange={(e) => setActivityNotes(e.target.value)} placeholder="What happened?" className="mt-1" rows={3} /></div>
            )}
            <Button className="w-full" onClick={handleSaveActivity} disabled={logActivityMutation.isPending}>{logActivityMutation.isPending ? 'Saving...' : 'Save Activity'}</Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Stage Confirm Drawer */}
      <Drawer open={stageConfirmOpen} onOpenChange={setStageConfirmOpen}>
        <DrawerContent>
          <DrawerHeader><DrawerTitle>Confirm Stage Change</DrawerTitle></DrawerHeader>
          <div className="p-4 space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium mb-1">Move {recruitFirstName} to: <span className="text-primary">{pendingStage}</span></p>
              <p className="text-sm text-muted-foreground">{pendingStage && getStageDescription(pendingStage)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setStageConfirmOpen(false); setPendingStage(null); }}>Cancel</Button>
              <Button className="flex-1" onClick={handleConfirmStageChange} disabled={updateStageMutation.isPending}>{updateStageMutation.isPending ? 'Saving...' : 'Confirm'}</Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Potential Follow Up Drawer - requires date selection */}
      <Drawer open={potentialFollowUpOpen} onOpenChange={(open) => {
        setPotentialFollowUpOpen(open);
        if (!open) {
          setPendingStage(null);
          setFollowUpDate('');
          setFollowUpNextStep('');
        }
      }}>
        <DrawerContent>
          <DrawerHeader><DrawerTitle>Schedule Follow Up</DrawerTitle></DrawerHeader>
          <div className="p-4 space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium mb-1">
                Moving {recruitFirstName} to <span className="text-primary">Potential Follow Up</span>
              </p>
              <p className="text-sm text-muted-foreground">
                When should you follow up with them?
              </p>
            </div>
            
            <div>
              <Label>Follow-up Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full mt-1 justify-start text-left font-normal">
                    <Calendar className="h-4 w-4 mr-2" />
                    {followUpDate ? format(parseISO(followUpDate), 'PPP') : 'Select date...'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={followUpDate ? parseISO(followUpDate) : undefined}
                    onSelect={(date) => date && setFollowUpDate(format(date, 'yyyy-MM-dd'))}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div>
              <Label>Notes (optional)</Label>
              <Textarea 
                value={followUpNextStep} 
                onChange={(e) => setFollowUpNextStep(e.target.value)} 
                placeholder="What's the next step?" 
                className="mt-1"
                rows={2}
              />
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { 
                setPotentialFollowUpOpen(false); 
                setPendingStage(null);
                setFollowUpDate('');
                setFollowUpNextStep('');
              }}>Cancel</Button>
              <Button 
                className="flex-1" 
                onClick={handleConfirmPotentialFollowUp} 
                disabled={!followUpDate || updateStageMutation.isPending || logActivityMutation.isPending}
              >
                {updateStageMutation.isPending || logActivityMutation.isPending ? 'Saving...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Onboarding Confirm Drawer */}
      <Drawer open={onboardingConfirmOpen} onOpenChange={setOnboardingConfirmOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {pendingOnboardingStep?.value ? 'Confirm Completion' : 'Undo Step'}
            </DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium mb-1">
                {pendingOnboardingStep?.value ? 'Mark complete:' : 'Undo:'} <span className="text-primary">{pendingOnboardingStep?.label}</span>
              </p>
              <p className="text-sm text-muted-foreground">{pendingOnboardingStep && getOnboardingStepDescription(pendingOnboardingStep.field, pendingOnboardingStep.value, recruitFirstName)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setOnboardingConfirmOpen(false); setPendingOnboardingStep(null); }}>Cancel</Button>
              <Button 
                className="flex-1" 
                variant={pendingOnboardingStep?.value ? 'default' : 'destructive'}
                onClick={handleConfirmOnboardingChange}
              >
                {pendingOnboardingStep?.value ? 'Confirm' : 'Undo'}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Phone Entry Drawer */}
      <Drawer open={phoneEntryOpen} onOpenChange={(o) => { setPhoneEntryOpen(o); if (!o) { setNewPhoneNumber(''); setPendingPhoneAction(null); } }}>
        <DrawerContent>
          <DrawerHeader><DrawerTitle>{phoneEntryTarget === 'recruit' ? `Add ${recruitFirstName}'s Phone` : `Add ${contactForHelp?.name}'s Phone`}</DrawerTitle></DrawerHeader>
          <div className="p-4 space-y-4">
            <Input value={newPhoneNumber} onChange={(e) => { const input = e.target.value.replace(/\D/g, '').slice(0, 10); let fmt = ''; if (input.length > 0) { fmt = '(' + input.slice(0, 3); if (input.length > 3) { fmt += ') ' + input.slice(3, 6); if (input.length > 6) fmt += '-' + input.slice(6, 10); } } setNewPhoneNumber(fmt || input); }} placeholder="(555) 123-4567" type="tel" autoFocus />
            <Button className="w-full" onClick={() => { if (!newPhoneNumber.trim()) { toast.error('Enter phone number'); return; } const targetId = phoneEntryTarget === 'recruit' ? recruit.id : contactForHelp?.id; if (!targetId) return; savePhoneMutation.mutate({ repId: targetId, phone: newPhoneNumber.trim() }, { onSuccess: () => { setPhoneEntryOpen(false); const saved = newPhoneNumber.trim(); setNewPhoneNumber(''); if (pendingPhoneAction === 'call') window.location.href = `tel:${saved}`; else if (pendingPhoneAction === 'text') window.location.href = `sms:${saved}`; else if (pendingPhoneAction === 'ask_help') window.location.href = `sms:${saved}?body=${encodeURIComponent(helpMessage)}`; setPendingPhoneAction(null); } }); }} disabled={savePhoneMutation.isPending}>{savePhoneMutation.isPending ? 'Saving...' : 'Save & Continue'}</Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Post Contact Drawer - with full scheduling flow */}
      <PostContactDrawer
        open={postContactOpen}
        onOpenChange={setPostContactOpen}
        recruit={recruit}
        contactMethod={postContactMethod}
        onComplete={() => {
          setPostContactOpen(false);
          queryClient.invalidateQueries({ queryKey: ['recruit-activities', recruit.id] });
          queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
        }}
      />

      {/* Edit Activity Drawer */}
      <Drawer open={editActivityOpen} onOpenChange={(o) => { setEditActivityOpen(o); if (!o) { setSelectedActivity(null); setEditDatePopoverOpen(false); } }}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center justify-between">
              <span>Edit Activity</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-4 overflow-y-auto">
            {selectedActivity && (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  {getActivityIcon(selectedActivity.activity_type, selectedActivity.notes)}
                  <span className="capitalize">{selectedActivity.activity_type.replace('_', ' ')}</span>
                </div>
                
                <div>
                  <Label>Notes</Label>
                  <Textarea 
                    value={editNotes} 
                    onChange={(e) => setEditNotes(e.target.value)} 
                    placeholder="Activity notes" 
                    className="mt-1" 
                    rows={3} 
                  />
                </div>
                
                <div>
                  <Label>Date</Label>
                  <Popover open={editDatePopoverOpen} onOpenChange={setEditDatePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal mt-1",
                          !editDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editDate ? format(parseISO(editDate), 'PPP') : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start" side="top">
                      <CalendarComponent
                        mode="single"
                        selected={editDate ? parseISO(editDate) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setEditDate(format(date, 'yyyy-MM-dd'));
                          }
                          setEditDatePopoverOpen(false);
                        }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Assignee selector - only show for next_step activities */}
                {selectedActivity.activity_type === 'next_step' && (
                  <div>
                    <Label className="flex items-center gap-2">
                      <UserCircle className="h-4 w-4" />
                      Assigned To
                    </Label>
                    <Select 
                      value={editAssignee || 'me'} 
                      onValueChange={(v) => setEditAssignee(v === 'me' ? null : v)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="me">Me</SelectItem>
                        {assignableUsers.map((user) => (
                          <SelectItem key={user.userId} value={user.userId}>
                            {user.name.split(' ')[0]} ({user.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <Button 
                  className="w-full" 
                  onClick={() => {
                    if (!selectedActivity) return;
                    updateActivityMutation.mutate(
                      { 
                        activityId: selectedActivity.id, 
                        notes: editNotes,
                        assignedToUserId: selectedActivity.activity_type === 'next_step' ? editAssignee : undefined,
                      },
                      {
                        onSuccess: () => {
                          toast.success('Activity updated');
                          setEditActivityOpen(false);
                          setSelectedActivity(null);
                          queryClient.invalidateQueries({ queryKey: ['recruit-activities', recruit.id] });
                          queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] });
                        },
                        onError: () => toast.error("Couldn't update activity"),
                      }
                    );
                  }}
                  disabled={updateActivityMutation.isPending}
                >
                  {updateActivityMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete Activity Confirm */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this activity log. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!selectedActivity) return;
                setIsDeleting(true);
                deleteActivityMutation.mutate(selectedActivity.id, {
                  onSuccess: () => {
                    toast.success('Activity deleted');
                    setDeleteConfirmOpen(false);
                    setEditActivityOpen(false);
                    setSelectedActivity(null);
                    setIsDeleting(false);
                    queryClient.invalidateQueries({ queryKey: ['recruit-activities', recruit.id] });
                  },
                  onError: () => {
                    toast.error("Couldn't delete activity");
                    setIsDeleting(false);
                  },
                });
              }}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Phase Verification Drawer - supports both verify and undo modes */}
      {recruit && recruitRepData && pendingPhaseVerification && (
        <PhaseVerificationDrawer
          open={phaseVerificationOpen}
          onOpenChange={(open) => {
            setPhaseVerificationOpen(open);
            if (!open) setHasPhaseError(false);
          }}
          recruitName={recruit.name}
          phase={pendingPhaseVerification.phase}
          isSubmitting={isPhaseVerifying}
          hasError={hasPhaseError}
          onConfirm={handleConfirmPhaseVerification}
          mode={pendingPhaseVerification.isUndo ? 'undo' : 'verify'}
          onUndo={handleUndoPhaseVerification}
          watchedVideos={(recruitRepData?.watched_videos as string[]) || []}
          goalsSetupComplete={recruitGoals?.setup_complete ?? false}
          hasCommittedBlitz={
            Array.isArray(recruitRepData?.committed_blitzes) &&
            (recruitRepData.committed_blitzes as unknown[]).length > 0
          }
        />
      )}

      {/* Scheduled Activity Action Sheet */}
      <ScheduledActivityActionSheet
        activity={scheduledActivityForAction}
        open={scheduledActionSheetOpen}
        onOpenChange={(open) => {
          setScheduledActionSheetOpen(open);
          if (!open) setScheduledActivityForAction(null);
        }}
        onMarkComplete={handleMarkScheduledComplete}
        onReschedule={handleRescheduleActivity}
        onDelete={handleDeleteScheduledActivity}
      />

      {/* Schedule Follow-up Drawer - full version with assign-to option */}
      <ScheduleFollowUpDrawer
        open={scheduleFollowUpDrawerOpen}
        onOpenChange={setScheduleFollowUpDrawerOpen}
        recruit={recruit}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['recruit-activities', recruit.id] });
        }}
      />
    </>
  );
};
