import { useState, useMemo, useEffect } from "react";
import { Recruit, RecruitActivity, useUpdateRecruitStage, useLogRecruitActivity, useUpdateRecruitActivity, useDeleteRecruitActivity } from "@/hooks/useGroupRecruits";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAutoStageProgression } from "@/hooks/useAutoStageProgression";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { differenceInDays, parseISO, format } from "date-fns";
import { AlertCircle, TrendingUp, Clock, Settings } from "lucide-react";

import { TabType, RecruitRepData, RecruitGoals, ContactForHelp } from "./types";
import { stripEmojis, getFirstName, getStageDescription, getOnboardingStepDescription } from "./utils";
import { RecruitHeader } from "./RecruitHeader";
import { QuickActionsBar } from "./QuickActionsBar";
import { FocusCard } from "./FocusCard";
import { ProgressTab } from "./tabs/ProgressTab";
import { ActivityTab } from "./tabs/ActivityTab";
import { DetailsTab } from "./tabs/DetailsTab";

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

interface RecruitDetailDrawerProps {
  recruit: Recruit | null;
  activities: RecruitActivity[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RecruitDetailDrawer = ({ 
  recruit: recruitProp, 
  activities: initialActivities, 
  open, 
  onOpenChange 
}: RecruitDetailDrawerProps) => {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('progress');
  
  // Dialog states
  const [logActivityOpen, setLogActivityOpen] = useState(false);
  const [isDirectSchedule, setIsDirectSchedule] = useState(false);
  const [editActivityOpen, setEditActivityOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [phoneEntryOpen, setPhoneEntryOpen] = useState(false);
  const [potentialFollowUpOpen, setPotentialFollowUpOpen] = useState(false);
  const [list100ConnectedOpen, setList100ConnectedOpen] = useState(false);
  const [postCallOpen, setPostCallOpen] = useState(false);
  const [postCallStatus, setPostCallStatus] = useState<'connected' | 'attempted' | null>(null);
  const [postCallNotes, setPostCallNotes] = useState('');
  const [followUpNextStep, setFollowUpNextStep] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<RecruitActivity | null>(null);
  const [activityType, setActivityType] = useState<'phone_call' | 'in_person' | 'note' | 'next_step'>('phone_call');
  const [activityNotes, setActivityNotes] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextActionDue, setNextActionDue] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDate, setEditDate] = useState('');
  const [pendingPhoneAction, setPendingPhoneAction] = useState<'ask_help' | 'call' | 'text' | null>(null);
  const [phoneEntryTarget, setPhoneEntryTarget] = useState<'recruit' | 'contact'>('contact');
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [stageConfirmOpen, setStageConfirmOpen] = useState(false);
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [onboardingConfirmOpen, setOnboardingConfirmOpen] = useState(false);
  const [pendingOnboardingStep, setPendingOnboardingStep] = useState<{ field: string; label: string; value: boolean } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [stageShake, setStageShake] = useState(false);
  const [activityShake, setActivityShake] = useState(false);

  const updateStageMutation = useUpdateRecruitStage();
  const logActivityMutation = useLogRecruitActivity();
  const updateActivityMutation = useUpdateRecruitActivity();
  const deleteActivityMutation = useDeleteRecruitActivity();
  const { data: teamAccess } = useTeamAccess();
  const queryClient = useQueryClient();
  const { checkAndUpdateStage } = useAutoStageProgression();

  // Live recruit data
  const { data: liveRecruit } = useQuery({
    queryKey: ['recruit-detail-live', recruitProp?.notionPageId],
    queryFn: () => {
      const cachedQueries = queryClient.getQueriesData<{ recruits: Recruit[] }>({ queryKey: ['group-recruits'] });
      for (const [, data] of cachedQueries) {
        const fromCache = data?.recruits?.find(r => r.notionPageId === recruitProp?.notionPageId);
        if (fromCache) return fromCache;
      }
      return recruitProp;
    },
    enabled: !!recruitProp?.notionPageId && open,
    staleTime: 0,
    refetchInterval: open ? 1000 : false,
  });
  
  const recruit = liveRecruit || recruitProp;

  // Live activities
  const { data: liveActivities } = useQuery({
    queryKey: ['recruit-activities', recruit?.notionPageId],
    queryFn: async () => {
      if (!recruit?.notionPageId) return [];
      const { data } = await supabase
        .from('recruit_activities')
        .select('*')
        .eq('rep_notion_page_id', recruit.notionPageId)
        .order('created_at', { ascending: false })
        .limit(50);
      return (data || []) as RecruitActivity[];
    },
    enabled: !!recruit?.notionPageId && open,
    staleTime: 0,
  });

  const activities = liveActivities ?? initialActivities;

  useEffect(() => {
    if (open && recruit) {
      checkAndUpdateStage(recruit.notionPageId, recruit.stage);
    }
  }, [open, recruit?.notionPageId, recruit?.stage, checkAndUpdateStage]);

  // Current user rep
  const { data: currentUserRep } = useQuery({
    queryKey: ['current-user-rep-for-drawer'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('reps').select('notion_page_id, name, team_leader, recruiter').eq('user_id', user.id).maybeSingle();
      return data;
    },
  });

  // Contact for help
  const { data: contactForHelp } = useQuery({
    queryKey: ['contact-for-help', recruit?.recruiterName, recruit?.teamName, currentUserRep?.name, teamAccess?.accessLevel],
    queryFn: async () => {
      if (!recruit) return null;
      const accessLevel = teamAccess?.accessLevel;
      const isLeaderOfLeaders = accessLevel === 'mgmt_group_lead' || accessLevel === 'area_director';
      let searchName = isLeaderOfLeaders ? recruit.teamName : recruit.recruiterName;
      const role = isLeaderOfLeaders ? 'leader' : 'recruiter';
      if (!searchName) return null;
      const cleanedSearchName = stripEmojis(searchName)?.toLowerCase();
      const currentUserName = stripEmojis(currentUserRep?.name || '')?.toLowerCase();
      if (cleanedSearchName === currentUserName) return null;
      const { data: repData } = await supabase.from('reps').select('name, phone, notion_page_id').ilike('name', `%${stripEmojis(searchName)}%`).maybeSingle();
      if (!repData) return null;
      return { name: getFirstName(repData.name), phone: repData.phone, notionPageId: repData.notion_page_id, role } as ContactForHelp;
    },
    enabled: !!recruit && !!teamAccess && !!currentUserRep,
    staleTime: 5 * 60 * 1000,
  });

  const isLeaderOfLeaders = teamAccess?.accessLevel === 'mgmt_group_lead' || teamAccess?.accessLevel === 'area_director';

  // Recruit rep data
  const { data: recruitRepData } = useQuery({
    queryKey: ['recruit-rep-data', recruit?.notionPageId],
    queryFn: async () => {
      if (!recruit?.notionPageId) return null;
      const { data } = await supabase.from('reps').select('*').eq('notion_page_id', recruit.notionPageId).maybeSingle();
      return data as RecruitRepData | null;
    },
    enabled: !!recruit?.notionPageId && open,
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

  // Help message
  const helpMessage = useMemo(() => {
    if (!recruit || !contactForHelp) return '';
    const recruitFirstName = getFirstName(recruit.name);
    return `Hey! What can I do to help ${recruitFirstName} sell 5+ before the summer?`;
  }, [recruit, contactForHelp]);

  // Save phone mutation
  const savePhoneMutation = useMutation({
    mutationFn: async ({ notionPageId, phone }: { notionPageId: string; phone: string }) => {
      const { error } = await supabase.from('reps').update({ phone }).eq('notion_page_id', notionPageId);
      if (error) throw error;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.functions.invoke('update-recruit-phone', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { recruitNotionId: notionPageId, phone },
        });
      }
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
    setTimeout(() => { setPostCallStatus(null); setPostCallNotes(''); setPostCallOpen(true); }, 500);
  };

  const handleText = async () => {
    if (!recruit.phone) {
      setPendingPhoneAction('text');
      setPhoneEntryTarget('recruit');
      setPhoneEntryOpen(true);
      return;
    }
    logActivityMutation.mutate({ recruitNotionId: recruit.notionPageId, activityType: 'phone_call', notes: 'Text sent', updateLastContact: true });
    toast.success('Text logged');
    window.location.href = `sms:${recruit.phone}`;
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
    if (newStage === 'Potential Follow Up') {
      setPotentialFollowUpOpen(true);
      return;
    }
    setPendingStage(newStage);
    setStageConfirmOpen(true);
  };

  const handleConfirmStageChange = () => {
    if (!pendingStage) return;
    updateStageMutation.mutate({ recruitNotionId: recruit.notionPageId, newStage: pendingStage }, {
      onSuccess: () => { toast.success(`Moved to ${pendingStage}`); setStageConfirmOpen(false); setPendingStage(null); },
      onError: () => { toast.error("Couldn't update stage"); setStageShake(true); setTimeout(() => setStageShake(false), 500); setStageConfirmOpen(false); setPendingStage(null); }
    });
  };

  const handleOnboardingStepClick = (field: string, label: string, currentValue: boolean) => {
    setPendingOnboardingStep({ field, label, value: !currentValue });
    setOnboardingConfirmOpen(true);
  };

  const handleConfirmOnboardingChange = async () => {
    if (!pendingOnboardingStep || !recruitRepData) return;
    const { field, value } = pendingOnboardingStep;
    
    // Define step order for cascading uncomplete
    const allStepsOrder = [
      'onboarding_complete', 'trainings_complete', 'slack_joined',
      'ramp_phase_1_complete', 'ramp_phase_2_complete', 'ramp_phase_3_complete', 'ramp_phase_4_complete'
    ];
    
    const fieldToNotionStatus: Record<string, string> = {
      'onboarding_complete': 'Onboarding ✅', 'trainings_complete': 'Trainings ✅', 'slack_joined': 'Slack Joined',
      'ramp_phase_1_complete': 'Phase 1 ✅', 'ramp_phase_2_complete': 'Phase 2 ✅', 'ramp_phase_3_complete': 'Phase 3 ✅', 'ramp_phase_4_complete': 'Phase 4 ✅',
    };
    const fieldToEdgeFunctionParam: Record<string, string> = {
      'ramp_phase_1_complete': 'rampPhase1Complete', 'ramp_phase_2_complete': 'rampPhase2Complete',
      'ramp_phase_3_complete': 'rampPhase3Complete', 'ramp_phase_4_complete': 'rampPhase4Complete',
    };
    
    // Build updates object - if uncompleting, also uncomplete all subsequent steps
    const updates: Record<string, boolean> = { [field]: value };
    if (!value) {
      const fieldIndex = allStepsOrder.indexOf(field);
      allStepsOrder.slice(fieldIndex + 1).forEach(subsequentField => {
        if (recruitRepData[subsequentField as keyof typeof recruitRepData]) {
          updates[subsequentField] = false;
        }
      });
    }
    
    // Optimistic update
    queryClient.setQueryData(['recruit-rep-data', recruit.notionPageId], (old: any) => old ? { ...old, ...updates } : old);
    setOnboardingConfirmOpen(false);
    setPendingOnboardingStep(null);
    try {
      const { error } = await supabase.from('reps').update(updates).eq('notion_page_id', recruit.notionPageId);
      if (error) throw error;
      if (value) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const edgeBody: Record<string, any> = { rookieNotionPageId: recruit.notionPageId };
          if (fieldToEdgeFunctionParam[field]) edgeBody[fieldToEdgeFunctionParam[field]] = value;
          else if (fieldToNotionStatus[field]) edgeBody.onboardingStatus = fieldToNotionStatus[field];
          await supabase.functions.invoke('update-rookie-status', { headers: { Authorization: `Bearer ${session.access_token}` }, body: edgeBody });
        }
      }
      const uncompleteCount = Object.keys(updates).length;
      toast.success(value ? 'Marked complete' : uncompleteCount > 1 ? `Unmarked ${uncompleteCount} steps` : 'Marked incomplete');
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      if (value && field === 'onboarding_complete') await checkAndUpdateStage(recruit.notionPageId, recruit.stage);
    } catch (error) {
      // Rollback optimistic update
      const rollback = Object.fromEntries(Object.keys(updates).map(k => [k, !updates[k]]));
      queryClient.setQueryData(['recruit-rep-data', recruit.notionPageId], (old: any) => old ? { ...old, ...rollback } : old);
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
    setIsDirectSchedule(true);
    setActivityType('next_step');
    setActivityNotes('');
    setLogActivityOpen(true);
  };

  const handleActivityClick = (activity: RecruitActivity) => {
    setSelectedActivity(activity);
    setEditNotes(activity.notes || '');
    setEditDate(format(parseISO(activity.created_at), 'yyyy-MM-dd'));
    setEditActivityOpen(true);
  };

  const handleSaveActivity = () => {
    if (!activityNotes && activityType !== 'next_step') { toast.error('Please add notes'); return; }
    logActivityMutation.mutate({
      recruitNotionId: recruit.notionPageId, activityType, notes: activityNotes,
      nextAction: activityType === 'next_step' ? nextAction : undefined,
      nextActionDue: activityType === 'next_step' ? nextActionDue : undefined,
      updateLastContact: activityType === 'phone_call' || activityType === 'in_person',
    }, {
      onSuccess: () => {
        toast.success('Activity logged');
        setLogActivityOpen(false);
        setActivityNotes(''); setNextAction(''); setNextActionDue('');
        queryClient.invalidateQueries({ queryKey: ['recruit-activities', recruit.notionPageId] });
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

      {/* Onboarding Confirm Drawer */}
      <Drawer open={onboardingConfirmOpen} onOpenChange={setOnboardingConfirmOpen}>
        <DrawerContent>
          <DrawerHeader><DrawerTitle>Confirm Onboarding Update</DrawerTitle></DrawerHeader>
          <div className="p-4 space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium mb-1">Mark as: <span className="text-primary">{pendingOnboardingStep?.label}</span></p>
              <p className="text-sm text-muted-foreground">{pendingOnboardingStep && getOnboardingStepDescription(pendingOnboardingStep.field, pendingOnboardingStep.value, recruitFirstName)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setOnboardingConfirmOpen(false); setPendingOnboardingStep(null); }}>Cancel</Button>
              <Button className="flex-1" onClick={handleConfirmOnboardingChange}>Confirm</Button>
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
            <Button className="w-full" onClick={() => { if (!newPhoneNumber.trim()) { toast.error('Enter phone number'); return; } const targetId = phoneEntryTarget === 'recruit' ? recruit.notionPageId : contactForHelp?.notionPageId; if (!targetId) return; savePhoneMutation.mutate({ notionPageId: targetId, phone: newPhoneNumber.trim() }, { onSuccess: () => { setPhoneEntryOpen(false); const saved = newPhoneNumber.trim(); setNewPhoneNumber(''); if (pendingPhoneAction === 'call') window.location.href = `tel:${saved}`; else if (pendingPhoneAction === 'text') window.location.href = `sms:${saved}`; else if (pendingPhoneAction === 'ask_help') window.location.href = `sms:${saved}?body=${encodeURIComponent(helpMessage)}`; setPendingPhoneAction(null); } }); }} disabled={savePhoneMutation.isPending}>{savePhoneMutation.isPending ? 'Saving...' : 'Save & Continue'}</Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Post Call Drawer */}
      <Drawer open={postCallOpen} onOpenChange={setPostCallOpen}>
        <DrawerContent>
          <DrawerHeader><DrawerTitle>How did it go?</DrawerTitle></DrawerHeader>
          <div className="p-4 space-y-4">
            <div className="flex gap-2">
              <Button variant={postCallStatus === 'connected' ? 'default' : 'outline'} className="flex-1" onClick={() => setPostCallStatus('connected')}><PhoneCall className="h-4 w-4 mr-2" />Connected</Button>
              <Button variant={postCallStatus === 'attempted' ? 'secondary' : 'outline'} className="flex-1" onClick={() => setPostCallStatus('attempted')}><PhoneMissed className="h-4 w-4 mr-2" />No Answer</Button>
            </div>
            <Textarea value={postCallNotes} onChange={(e) => setPostCallNotes(e.target.value)} placeholder="Notes (optional)" rows={2} />
            <Button className="w-full" disabled={!postCallStatus || logActivityMutation.isPending} onClick={() => { const notes = postCallStatus === 'connected' ? (postCallNotes.trim() ? `Connected: ${postCallNotes}` : 'Connected') : (postCallNotes.trim() ? `No Answer: ${postCallNotes}` : 'No Answer'); logActivityMutation.mutate({ recruitNotionId: recruit.notionPageId, activityType: 'phone_call', notes, updateLastContact: postCallStatus === 'connected' }, { onSuccess: () => { toast.success('Call logged'); setPostCallOpen(false); setPostCallStatus(null); setPostCallNotes(''); queryClient.invalidateQueries({ queryKey: ['recruit-activities', recruit.notionPageId] }); } }); }}>{logActivityMutation.isPending ? 'Saving...' : 'Save'}</Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
