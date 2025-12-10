import { useState, useMemo, useEffect } from "react";
import { Recruit, RecruitActivity, useUpdateRecruitStage, useLogRecruitActivity, useUpdateRecruitActivity, useDeleteRecruitActivity } from "@/hooks/useGroupRecruits";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAutoStageProgression } from "@/hooks/useAutoStageProgression";
import { useBlitzes } from "@/hooks/useBlitzes";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { 
  Phone, 
  MessageSquare, 
  Users, 
  Calendar,
  Clock,
  CheckCircle2,
  Plus,
  Trash2,
  PhoneCall,
  PhoneMissed,
  UserRound,
  AlertCircle,
  AlertTriangle,
  Tablet,
  Plane,
  MapPin,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  History,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { format, parseISO, differenceInDays, startOfWeek, startOfMonth, isThisWeek, isThisMonth, subWeeks, subMonths, isAfter, isBefore } from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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

// Helper to strip emojis from names for cleaner display
const stripEmojis = (text: string | null): string | null => {
  if (!text) return null;
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
};

const getFirstName = (name: string | null): string => {
  if (!name) return '';
  const cleaned = stripEmojis(name) || '';
  return cleaned.split(' ')[0];
};

const STAGES = [
  '100 List',
  'Potential Follow Up',
  'Reached Out',
  'Evaluating',
  'Signed',
  'Shadow ✅',
  'Sold 💲',
  'Sold (5+) 💰',
  'Signed but Not Interested',
  'Not Interested',
];

// Blitz Management Sub-component - Collapsible with Past + Future blitzes
const BlitzManagementSection = ({ 
  recruit, 
  recruitRepData, 
  queryClient 
}: { 
  recruit: Recruit; 
  recruitRepData: any; 
  queryClient: any;
}) => {
  const { allBlitzes, pastBlitzes: allPastBlitzes } = useBlitzes();
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  
  // committed_blitzes can come from recruitRepData (Supabase reps table) OR recruit.committedBlitzes (Notion)
  // For recruits who haven't signed up, recruitRepData will be null, so we need both sources
  const committedBlitzIds = useMemo(() => {
    // First try recruitRepData (Supabase) - this has the most up-to-date local data
    const rawFromSupabase = recruitRepData?.committed_blitzes;
    // Then try recruit.committedBlitzes (from Notion via fetch-group-recruits)
    const rawFromNotion = recruit?.committedBlitzes;
    
    // Use Supabase data if available, otherwise fall back to Notion data
    const raw = (rawFromSupabase && Array.isArray(rawFromSupabase) && rawFromSupabase.length > 0) 
      ? rawFromSupabase 
      : rawFromNotion;
    
    if (!raw || !Array.isArray(raw)) return [];
    return raw.map((item: string | { id: string }) => 
      typeof item === 'string' ? item : item?.id
    ).filter(Boolean) as string[];
  }, [recruitRepData?.committed_blitzes, recruit?.committedBlitzes]);
  
  const now = new Date();
  
  // Get past blitzes the recruit attended (from all past blitzes)
  const pastBlitzes = useMemo(() => {
    return allPastBlitzes.filter(blitz => committedBlitzIds.includes(blitz.id));
  }, [allPastBlitzes, committedBlitzIds]);
  
  // Future blitzes are already from allBlitzes (which only contains future)
  const futureBlitzes = allBlitzes;
  
  // Count committed future blitzes
  const committedFutureCount = futureBlitzes.filter(b => committedBlitzIds.includes(b.id)).length;
  
  const handleToggleBlitz = async (blitzId: string, blitzName: string, isCurrentlyCommitted: boolean) => {
    if (!recruit?.notionPageId) return;
    
    setIsUpdating(blitzId);
    
    // Optimistic update
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
      
      toast.success(isCurrentlyCommitted 
        ? `Removed from ${blitzName}` 
        : `Committed to ${blitzName}`
      );
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      queryClient.invalidateQueries({ queryKey: ['recruit-rep-data'] });
    } catch (error) {
      // Revert on error
      queryClient.setQueryData(['recruit-rep-data', recruit.notionPageId], (old: any) => 
        old ? { ...old, committed_blitzes: committedBlitzIds } : old
      );
      toast.error("Couldn't update blitz commitment");
    } finally {
      setIsUpdating(null);
    }
  };
  
  // Summary text for collapsed state
  const getSummaryText = () => {
    if (committedFutureCount === 0 && pastBlitzes.length === 0) {
      return "No blitz history yet";
    }
    const parts: string[] = [];
    if (committedFutureCount > 0) {
      parts.push(`${committedFutureCount} upcoming`);
    }
    if (pastBlitzes.length > 0) {
      parts.push(`${pastBlitzes.length} attended`);
    }
    return parts.join(' · ');
  };
  
  if (futureBlitzes.length === 0 && pastBlitzes.length === 0) return null;
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Plane className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">Blitz Commitments</p>
              <p className="text-xs text-muted-foreground">{getSummaryText()}</p>
            </div>
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="mt-3 space-y-4">
          {/* Past Blitzes Section */}
          {pastBlitzes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <History className="h-3 w-3" />
                <span>Previous Blitzes</span>
              </div>
              <div className="space-y-2">
                {pastBlitzes.map((blitz) => {
                  const blitzDate = new Date(blitz.date);
                  return (
                    <div 
                      key={blitz.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center">
                          <Check className="h-3 w-3 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">{blitz.name}</p>
                          <p className="text-xs text-muted-foreground/70">
                            {format(blitzDate, 'MMM d')}
                            {blitz.endDate && ` - ${format(new Date(blitz.endDate), 'MMM d')}`}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs text-green-600 border-green-600/30">
                        Attended
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Future Blitzes Section */}
          {futureBlitzes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>Upcoming Blitzes</span>
              </div>
              <div className="space-y-2">
                {futureBlitzes.map((blitz) => {
                  const isCommitted = committedBlitzIds.includes(blitz.id);
                  const blitzDate = new Date(blitz.date);
                  const isLoading = isUpdating === blitz.id;
                  const daysUntil = differenceInDays(blitzDate, now);
                  
                  return (
                    <div 
                      key={blitz.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        isCommitted 
                          ? 'bg-primary/5 border-primary/30' 
                          : 'bg-muted/50 border-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isCommitted ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                        }`}>
                          {isCommitted ? <Plane className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{blitz.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(blitzDate, 'MMM d')}
                            {blitz.endDate && ` - ${format(new Date(blitz.endDate), 'MMM d')}`}
                            {daysUntil <= 14 && daysUntil >= 0 && (
                              <span className="ml-1 text-amber-500">· {daysUntil}d away</span>
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
                        {isLoading ? (
                          <span className="animate-pulse">...</span>
                        ) : isCommitted ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Going
                          </>
                        ) : (
                          'Commit'
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

interface RecruitDetailDrawerProps {
  recruit: Recruit | null;
  activities: RecruitActivity[]; // Kept for initial data, but we'll refetch live
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RecruitDetailDrawer = ({ 
  recruit: recruitProp, 
  activities: initialActivities, 
  open, 
  onOpenChange 
}: RecruitDetailDrawerProps) => {
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
  
  // Stage/onboarding change confirmation
  const [stageConfirmOpen, setStageConfirmOpen] = useState(false);
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [onboardingConfirmOpen, setOnboardingConfirmOpen] = useState(false);
  const [pendingOnboardingStep, setPendingOnboardingStep] = useState<{ field: string; label: string; value: boolean } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Error shake state
  const [stageShake, setStageShake] = useState(false);
  const [activityShake, setActivityShake] = useState(false);

  const updateStageMutation = useUpdateRecruitStage();
  const logActivityMutation = useLogRecruitActivity();
  const updateActivityMutation = useUpdateRecruitActivity();
  const deleteActivityMutation = useDeleteRecruitActivity();
  const { data: teamAccess } = useTeamAccess();
  const queryClient = useQueryClient();
  const { checkAndUpdateStage, checkReachedOutProgression } = useAutoStageProgression();

  // Subscribe to group-recruits query to get live recruit data updates
  const { data: liveRecruit } = useQuery({
    queryKey: ['recruit-detail-live', recruitProp?.notionPageId],
    queryFn: () => {
      // Get from any group-recruits cache - use fuzzy matching for query key variations
      const cachedQueries = queryClient.getQueriesData<{ recruits: Recruit[] }>({ queryKey: ['group-recruits'] });
      for (const [, data] of cachedQueries) {
        const fromCache = data?.recruits?.find(r => r.notionPageId === recruitProp?.notionPageId);
        if (fromCache) return fromCache;
      }
      return recruitProp;
    },
    enabled: !!recruitProp?.notionPageId && open,
    staleTime: 0,
    refetchInterval: open ? 1000 : false, // Poll every second while drawer is open
  });
  
  const recruit = liveRecruit || recruitProp;

  // Fetch activities directly for this recruit to get live updates
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
    staleTime: 0, // Always refetch when drawer opens
  });

  // Use live activities if available, otherwise fall back to initial
  const activities = liveActivities ?? initialActivities;

  // Auto-check stage progression when drawer opens
  useEffect(() => {
    if (open && recruit) {
      checkAndUpdateStage(recruit.notionPageId, recruit.stage);
    }
  }, [open, recruit?.notionPageId, recruit?.stage, checkAndUpdateStage]);

  // Get current user's info
  const { data: currentUserRep } = useQuery({
    queryKey: ['current-user-rep-for-drawer'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from('reps')
        .select('notion_page_id, name, team_leader, recruiter')
        .eq('user_id', user.id)
        .maybeSingle();
      
      return data;
    },
  });

  // Get leader/recruiter phone number for the "Ask for Help" button - eager loading with staleTime
  const { data: contactForHelp, isLoading: contactForHelpLoading } = useQuery({
    queryKey: ['contact-for-help', recruit?.recruiterName, recruit?.teamName, currentUserRep?.name, teamAccess?.accessLevel],
    queryFn: async () => {
      if (!recruit) return null;
      
      // For MGMT/AD: text the leader (team name)
      // For leaders: text the recruiter
      const accessLevel = teamAccess?.accessLevel;
      const isLeaderOfLeaders = accessLevel === 'mgmt_group_lead' || accessLevel === 'area_director';
      
      let searchName: string | null = null;
      let role: 'leader' | 'recruiter' = 'leader';
      
      if (isLeaderOfLeaders) {
        // MGMT/AD should text the team leader
        searchName = recruit.teamName;
        role = 'leader';
      } else {
        // Team leads should text the recruiter
        searchName = recruit.recruiterName;
        role = 'recruiter';
      }
      
      if (!searchName) return null;
      
      // Check if this is the current user
      const cleanedSearchName = stripEmojis(searchName)?.toLowerCase();
      const currentUserName = stripEmojis(currentUserRep?.name || '')?.toLowerCase();
      
      if (cleanedSearchName === currentUserName) {
        return null; // Don't show button if they ARE the leader/recruiter
      }
      
      // Fetch phone number
      const { data: repData } = await supabase
        .from('reps')
        .select('name, phone, notion_page_id')
        .ilike('name', `%${stripEmojis(searchName)}%`)
        .maybeSingle();
      
      if (!repData) return null;
      
      return {
        name: getFirstName(repData.name),
        phone: repData.phone,
        notionPageId: repData.notion_page_id,
        role,
      };
    },
    enabled: !!recruit && !!teamAccess && !!currentUserRep,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes to prevent loading delay
  });

  // Check if current user is a leader of leaders (MGMT or AD)
  const isLeaderOfLeaders = teamAccess?.accessLevel === 'mgmt_group_lead' || 
                            teamAccess?.accessLevel === 'area_director';

  // Fetch recruit's rep record for additional context (blitzes, ramp progress, etc.)
  const { data: recruitRepData } = useQuery({
    queryKey: ['recruit-rep-data', recruit?.notionPageId],
    queryFn: async () => {
      if (!recruit?.notionPageId) return null;
      
      const { data } = await supabase
        .from('reps')
        .select('*')
        .eq('notion_page_id', recruit.notionPageId)
        .maybeSingle();
      
      return data;
    },
    enabled: !!recruit?.notionPageId && open,
  });

  // Fetch recruit's goals for preseason standards tracking
  const { data: recruitGoals } = useQuery({
    queryKey: ['recruit-goals', recruitRepData?.user_id],
    queryFn: async () => {
      if (!recruitRepData?.user_id) return null;
      
      const { data } = await supabase
        .from('rep_goals')
        .select('*')
        .eq('user_id', recruitRepData.user_id)
        .maybeSingle();
      
      return data;
    },
    enabled: !!recruitRepData?.user_id && open,
  });

  // Fetch recruit's YTD FP+ from daily_entries
  const { data: recruitYtdFP } = useQuery({
    queryKey: ['recruit-ytd-fp', recruitRepData?.user_id],
    queryFn: async () => {
      if (!recruitRepData?.user_id) return 0;
      
      const { data } = await supabase
        .from('daily_entries')
        .select('fp_plus')
        .eq('user_id', recruitRepData.user_id)
        .eq('is_finalized', true);
      
      if (!data) return 0;
      
      return data.reduce((sum, entry) => sum + (entry.fp_plus || 0), 0);
    },
    enabled: !!recruitRepData?.user_id && open,
  });

  // Generate context-aware help message with urgency-based priority matrix
  const helpMessage = useMemo(() => {
    if (!recruit || !contactForHelp) return '';
    
    const recruitFirstName = getFirstName(recruit.name);
    const daysSinceContact = recruit.lastContact 
      ? differenceInDays(new Date(), parseISO(recruit.lastContact))
      : null;
    
    const stage = recruit.stage?.toLowerCase() || '';
    const now = new Date();
    
    // Build context flags
    const isSigned = stage.includes('signed');
    const isShadowed = stage.includes('shadow');
    const hasSold = stage.includes('sold');
    const hasSold5Plus = stage.includes('5+');
    const isEvaluating = stage.includes('evaluating');
    const isReachedOut = stage.includes('reached');
    const is100List = stage.includes('100') || stage.includes('list');
    
    // Rep data context
    const committedBlitzes = recruitRepData?.committed_blitzes as string[] | null;
    const hasBlitzCommitment = committedBlitzes && committedBlitzes.length > 0;
    const blitzTripDate = recruitRepData?.blitz_trip_date ? parseISO(recruitRepData.blitz_trip_date) : null;
    const daysToBlitz = blitzTripDate ? differenceInDays(blitzTripDate, now) : null;
    const isBlitzApproaching = daysToBlitz !== null && daysToBlitz >= 0 && daysToBlitz <= 14;
    
    // Ramp to Blitz progress
    const rampPhase = recruitRepData?.ramp_to_blitz_phase || 'Not started';
    const isRampNotStarted = rampPhase === 'Not started';
    const isRampPhase1 = rampPhase?.includes('Phase 1');
    const isRampPhase2 = rampPhase?.includes('Phase 2');
    const isRampPhase3 = rampPhase?.includes('Phase 3');
    const isRampIncomplete = isRampNotStarted || isRampPhase1 || isRampPhase2 || isRampPhase3;
    
    // Onboarding status
    const onboardingComplete = recruitRepData?.onboarding_complete ?? false;
    const trainingsComplete = recruitRepData?.trainings_complete ?? false;
    const ipadAssigned = recruitRepData?.ipad_assigned ?? false;
    const slackJoined = recruitRepData?.slack_joined ?? false;
    
    // Preseason standards progress (from goals)
    const trainingGoal = recruitGoals?.training_hours_goal || 0;
    const trainingProgress = recruitGoals?.training_hours_progress || 0;
    const booksGoal = recruitGoals?.books_goal || 0;
    const booksProgress = recruitGoals?.books_progress || 0;
    const rolePlaysGoal = recruitGoals?.role_plays_goal || 0;
    const rolePlaysProgress = recruitGoals?.role_plays_progress || 0;
    const blitzesGoal = recruitGoals?.blitzes_goal || 0;
    const blitzesProgress = recruitGoals?.blitzes_progress || 0;
    
    // Calculate if behind on preseason standards
    const trainingBehind = trainingGoal > 0 && trainingProgress < trainingGoal * 0.5;
    const booksBehind = booksGoal > 0 && booksProgress < booksGoal * 0.5;
    const rolePlaysBehind = rolePlaysGoal > 0 && rolePlaysProgress < rolePlaysGoal * 0.5;
    const blitzesBehind = blitzesGoal > 0 && blitzesProgress < blitzesGoal * 0.5;
    const isBehindOnStandards = trainingBehind || booksBehind || rolePlaysBehind || blitzesBehind;
    
    // Build urgency-prioritized scenarios (higher priority = more urgent/important)
    interface Scenario {
      priority: number; // Higher = more urgent/important
      message: string;
    }
    
    const scenarios: Scenario[] = [];
    
    // ===== PRIORITY 1: CRITICAL / URGENT (Blitz approaching + blockers) =====
    
    // Signed but no blitz commitment and blitz is approaching
    if (isSigned && !hasBlitzCommitment && isBlitzApproaching) {
      scenarios.push({
        priority: 100,
        message: `🚨 ${recruitFirstName} is signed but hasn't committed to a blitz and one starts in ${daysToBlitz} days! Can we get them locked in ASAP?`
      });
    }
    
    // Signed with blitz approaching but not ready (missing iPad, ramp incomplete, etc.)
    if (isSigned && hasBlitzCommitment && isBlitzApproaching && !ipadAssigned) {
      scenarios.push({
        priority: 95,
        message: `🚨 ${recruitFirstName}'s blitz starts in ${daysToBlitz} days but they don't have an iPad assigned yet. Can we get that sorted?`
      });
    }
    
    if (isSigned && hasBlitzCommitment && isBlitzApproaching && isRampIncomplete) {
      scenarios.push({
        priority: 94,
        message: `🚨 ${recruitFirstName}'s blitz is in ${daysToBlitz} days but they're still on ${rampPhase}. What can we do to accelerate their prep?`
      });
    }
    
    if (isSigned && hasBlitzCommitment && isBlitzApproaching && !trainingsComplete) {
      scenarios.push({
        priority: 93,
        message: `🚨 ${recruitFirstName} has a blitz in ${daysToBlitz} days but hasn't finished required trainings. Can we help them get those done?`
      });
    }
    
    // ===== PRIORITY 2: HIGH (Critical stage issues) =====
    
    // Signed but never started onboarding
    if (isSigned && !onboardingComplete) {
      scenarios.push({
        priority: 85,
        message: `Hey! ${recruitFirstName} is signed but hasn't completed onboarding yet. What's blocking them from getting started?`
      });
    }
    
    // Behind on preseason standards
    if (isSigned && isBehindOnStandards) {
      const behindItems: string[] = [];
      if (trainingBehind) behindItems.push('training hours');
      if (booksBehind) behindItems.push('books');
      if (rolePlaysBehind) behindItems.push('role plays');
      if (blitzesBehind) behindItems.push('blitz attendance');
      
      scenarios.push({
        priority: 80,
        message: `Hey! ${recruitFirstName} is falling behind on preseason standards (${behindItems.join(', ')}). How can I help get them back on track?`
      });
    }
    
    // Signed but not on Slack
    if (isSigned && !slackJoined) {
      scenarios.push({
        priority: 75,
        message: `Hey! ${recruitFirstName} hasn't joined Slack yet. Can we get them connected so they don't miss important updates?`
      });
    }
    
    // Signed but no blitz commitment (not urgent if no blitz approaching)
    if (isSigned && !hasBlitzCommitment && !isBlitzApproaching) {
      scenarios.push({
        priority: 70,
        message: `Hey! ${recruitFirstName} is signed but I don't see them committed to any blitzes yet. Can we get them on a trip? How can I help?`
      });
    }
    
    // ===== PRIORITY 3: MEDIUM (Stale contacts, stuck in funnel) =====
    
    // Very stale contact (21+ days)
    if (daysSinceContact && daysSinceContact >= 21) {
      scenarios.push({
        priority: 65,
        message: `Hey! It's been ${daysSinceContact} days since anyone touched base with ${recruitFirstName}. Are they still interested? How can I help re-engage?`
      });
    }
    
    // Evaluating for too long (7+ days stale)
    if (isEvaluating && daysSinceContact && daysSinceContact >= 7) {
      scenarios.push({
        priority: 60,
        message: `Hey! ${recruitFirstName} has been evaluating for a while (${daysSinceContact} days since last contact). What's holding them back from signing?`
      });
    }
    
    // Shadow complete but not sold yet
    if (isShadowed && !hasSold) {
      scenarios.push({
        priority: 55,
        message: `Hey! ${recruitFirstName} has shadowed - how can I help them get their first sale? Any specific areas they need coaching on?`
      });
    }
    
    // Sold but not at 5+
    if (hasSold && !hasSold5Plus) {
      scenarios.push({
        priority: 50,
        message: `Hey! ${recruitFirstName} has a sale under their belt. What can I do to help them hit 5+ before summer?`
      });
    }
    
    // ===== PRIORITY 4: LOWER (Pipeline building) =====
    
    // Reached out but stale
    if (isReachedOut && daysSinceContact && daysSinceContact >= 5) {
      scenarios.push({
        priority: 45,
        message: `Hey! We reached out to ${recruitFirstName} ${daysSinceContact} days ago. Any response? How can I help follow up?`
      });
    }
    
    // Evaluating - general progress check
    if (isEvaluating) {
      scenarios.push({
        priority: 40,
        message: `Hey! How can I help move ${recruitFirstName} forward? What's holding them back from signing?`
      });
    }
    
    // Moderately stale (14+ days)
    if (daysSinceContact && daysSinceContact >= 14 && daysSinceContact < 21) {
      scenarios.push({
        priority: 35,
        message: `Hey! It's been ${daysSinceContact} days since we connected with ${recruitFirstName}. How can I help get them re-engaged?`
      });
    }
    
    // 100 List - need introduction
    if (is100List) {
      scenarios.push({
        priority: 30,
        message: `Hey! I'm looking at ${recruitFirstName} on the list. Could you give me an intro or let me know how I can help reach out?`
      });
    }
    
    // Reached out - general
    if (isReachedOut) {
      scenarios.push({
        priority: 25,
        message: `Hey! How's ${recruitFirstName} responding? Anything I can do to help move them to evaluating?`
      });
    }
    
    // ===== DEFAULT =====
    scenarios.push({
      priority: 0,
      message: `Hey! What can I do to help ${recruitFirstName} sell 5+ before the summer?`
    });
    
    // Sort by priority (highest first) and return the top message
    scenarios.sort((a, b) => b.priority - a.priority);
    return scenarios[0].message;
  }, [recruit, contactForHelp, recruitRepData, recruitGoals]);

  // Save phone number mutation - syncs to both Supabase and Notion
  const savePhoneMutation = useMutation({
    mutationFn: async ({ notionPageId, phone }: { notionPageId: string; phone: string }) => {
      // Update in Supabase
      const { error } = await supabase
        .from('reps')
        .update({ phone })
        .eq('notion_page_id', notionPageId);
      
      if (error) throw error;
      
      // Sync to Notion via edge function
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
      queryClient.invalidateQueries({ queryKey: ['recruit-rep-data'] });
      toast.success('Phone number saved');
    },
    onError: () => {
      toast.error("Couldn't save phone number");
    },
  });

  if (!recruit) return null;

  const isStale = recruit.lastContact 
    ? differenceInDays(new Date(), parseISO(recruit.lastContact)) >= 7 
    : true;

  const triggerErrorToast = (message: string) => {
    toast.error(message, {
      icon: <AlertCircle className="h-5 w-5 text-destructive" />,
      duration: 4000,
    });
  };

  const handleCall = async () => {
    if (!recruit.phone) {
      setPendingPhoneAction('call');
      setPhoneEntryTarget('recruit');
      setPhoneEntryOpen(true);
      return;
    }
    // Open phone app first
    window.location.href = `tel:${recruit.phone}`;
    // Then show post-call drawer for logging
    setTimeout(() => {
      setPostCallStatus(null);
      setPostCallNotes('');
      setPostCallOpen(true);
    }, 500);
  };

  const handleText = async () => {
    if (!recruit.phone) {
      setPendingPhoneAction('text');
      setPhoneEntryTarget('recruit');
      setPhoneEntryOpen(true);
      return;
    }
    logActivityMutation.mutate({
      recruitNotionId: recruit.notionPageId,
      activityType: 'phone_call',
      notes: 'Text sent',
      updateLastContact: true,
    }, {
      onError: () => {
        triggerErrorToast("Couldn't save text - please try again");
        setActivityShake(true);
        setTimeout(() => setActivityShake(false), 500);
      }
    });
    toast.success('Text logged');
    window.location.href = `sms:${recruit.phone}`;
  };

  const handleAskForHelp = () => {
    if (!contactForHelp) return;
    
    if (!contactForHelp.phone) {
      // No phone number - prompt to enter it
      setPendingPhoneAction('ask_help');
      setPhoneEntryTarget('contact');
      setPhoneEntryOpen(true);
      return;
    }
    
    const encodedMessage = encodeURIComponent(helpMessage);
    window.location.href = `sms:${contactForHelp.phone}?body=${encodedMessage}`;
  };

  const handleSavePhoneAndProceed = async () => {
    if (!newPhoneNumber.trim()) {
      toast.error('Please enter a phone number');
      return;
    }
    
    const targetNotionId = phoneEntryTarget === 'recruit' 
      ? recruit.notionPageId 
      : contactForHelp?.notionPageId;
    
    if (!targetNotionId) {
      toast.error('Cannot save phone number');
      return;
    }
    
    savePhoneMutation.mutate({
      notionPageId: targetNotionId,
      phone: newPhoneNumber.trim(),
    }, {
      onSuccess: () => {
        setPhoneEntryOpen(false);
        const savedPhone = newPhoneNumber.trim();
        setNewPhoneNumber('');
        
        // Now proceed with the original action
        if (pendingPhoneAction === 'ask_help') {
          const encodedMessage = encodeURIComponent(helpMessage);
          window.location.href = `sms:${savedPhone}?body=${encodedMessage}`;
        } else if (pendingPhoneAction === 'call') {
          logActivityMutation.mutate({
            recruitNotionId: recruit.notionPageId,
            activityType: 'phone_call',
            notes: 'Call attempt',
            updateLastContact: true,
          });
          toast.success('Call logged');
          window.location.href = `tel:${savedPhone}`;
        } else if (pendingPhoneAction === 'text') {
          logActivityMutation.mutate({
            recruitNotionId: recruit.notionPageId,
            activityType: 'phone_call',
            notes: 'Text sent',
            updateLastContact: true,
          });
          toast.success('Text logged');
          window.location.href = `sms:${savedPhone}`;
        }
        setPendingPhoneAction(null);
        setPhoneEntryTarget('contact');
      }
    });
  };

  const handleStageChange = (newStage: string) => {
    // Require next step + date for Potential Follow Up
    if (newStage === 'Potential Follow Up') {
      setPotentialFollowUpOpen(true);
      return;
    }
    
    // Show confirmation for all other stage changes
    setPendingStage(newStage);
    setStageConfirmOpen(true);
  };

  const handleConfirmStageChange = () => {
    if (!pendingStage) return;
    
    updateStageMutation.mutate({
      recruitNotionId: recruit.notionPageId,
      newStage: pendingStage,
    }, {
      onSuccess: () => {
        toast.success(`Moved to ${pendingStage}`);
        setStageConfirmOpen(false);
        setPendingStage(null);
      },
      onError: () => {
        triggerErrorToast("Couldn't update stage - please try again");
        setStageShake(true);
        setTimeout(() => setStageShake(false), 500);
        setStageConfirmOpen(false);
        setPendingStage(null);
      }
    });
  };

  const getStageDescription = (stage: string): string => {
    switch (stage) {
      case '100 List': return 'A potential recruit on the initial list who hasn\'t been contacted yet.';
      case 'Reached Out': return 'You\'ve made initial contact but haven\'t had a meaningful conversation yet.';
      case 'Evaluating': return 'They\'re interested and actively considering the opportunity.';
      case 'Signed': return 'They\'ve committed to join and are starting onboarding!';
      case 'Shadow ✅': return 'They\'ve attended a blitz and shadowed in the field.';
      case 'Sold 💲': return 'They\'ve made their first sale!';
      case 'Sold (5+) 💰': return 'They\'ve sold 5 or more FP+ and are on track!';
      case 'Not Interested': return 'They declined the opportunity.';
      case 'Signed but Not Interested': return 'They signed but later decided not to continue.';
      case 'Potential Follow Up': return 'Not ready now but worth following up later.';
      default: return '';
    }
  };

  const handleConfirmPotentialFollowUp = () => {
    if (!followUpNextStep.trim()) {
      toast.error('Please describe the next step');
      return;
    }
    if (!followUpDate) {
      toast.error('Please select a follow-up date');
      return;
    }

    // First log the scheduled activity
    logActivityMutation.mutate({
      recruitNotionId: recruit.notionPageId,
      activityType: 'next_step',
      notes: `Marked as Potential Follow Up`,
      nextAction: followUpNextStep,
      nextActionDue: followUpDate,
      updateLastContact: false,
    }, {
      onSuccess: () => {
        // Then update the stage
        updateStageMutation.mutate({
          recruitNotionId: recruit.notionPageId,
          newStage: 'Potential Follow Up',
        }, {
          onSuccess: () => {
            toast.success('Moved to Potential Follow Up');
            setPotentialFollowUpOpen(false);
            setFollowUpNextStep('');
            setFollowUpDate('');
          },
          onError: () => {
            triggerErrorToast("Couldn't update stage - please try again");
            setStageShake(true);
            setTimeout(() => setStageShake(false), 500);
          }
        });
      },
      onError: () => {
        triggerErrorToast("Couldn't save follow-up - please try again");
      }
    });
  };

  const handleLogActivity = async () => {
    if (!activityNotes && activityType !== 'next_step') {
      toast.error('Please add some notes');
      return;
    }

    // Check if this is a "connected" activity for 100 List stage
    const isConnectedActivity = (activityType === 'phone_call' || activityType === 'in_person') &&
      activityNotes?.toLowerCase() !== 'no answer' &&
      activityNotes?.toLowerCase() !== 'call attempt';
    
    const is100List = recruit.stage?.toLowerCase().includes('100') || 
                      recruit.stage?.toLowerCase().includes('list');
    
    logActivityMutation.mutate({
      recruitNotionId: recruit.notionPageId,
      activityType,
      notes: activityNotes,
      nextAction: activityType === 'next_step' ? nextAction : undefined,
      nextActionDue: activityType === 'next_step' ? nextActionDue : undefined,
      updateLastContact: activityType === 'phone_call' || activityType === 'in_person',
    }, {
      onSuccess: async () => {
        toast.success('Activity logged');
        setLogActivityOpen(false);
        setActivityNotes('');
        setNextAction('');
        setNextActionDue('');
        
        // Invalidate the live activities query for immediate UI update
        queryClient.invalidateQueries({ queryKey: ['recruit-activities', recruit.notionPageId] });
        
        // If connected with someone in 100 List, show stage selection popup
        if (is100List && isConnectedActivity) {
          setList100ConnectedOpen(true);
        } else {
          // Auto-check for stage progression based on metrics
          await checkAndUpdateStage(recruit.notionPageId, recruit.stage);
        }
      },
      onError: () => {
        triggerErrorToast("Couldn't save activity - please try again");
        setActivityShake(true);
        setTimeout(() => setActivityShake(false), 500);
      }
    });
  };

  // Handle 100 List connected stage selection
  const handleList100StageSelect = (newStage: string) => {
    updateStageMutation.mutate({
      recruitNotionId: recruit.notionPageId,
      newStage,
      notes: `Progressed from 100 List after connecting`,
    }, {
      onSuccess: () => {
        toast.success(`Moved to ${newStage}`);
        setList100ConnectedOpen(false);
      },
      onError: () => {
        triggerErrorToast("Couldn't update stage - please try again");
        setStageShake(true);
        setTimeout(() => setStageShake(false), 500);
      }
    });
  };

  // Handle post-call logging (after Call button press)
  const handlePostCallSave = () => {
    if (!postCallStatus) {
      toast.error('Please select if the call connected or was attempted');
      return;
    }
    
    const notes = postCallStatus === 'connected' 
      ? (postCallNotes.trim() ? `Connected: ${postCallNotes}` : 'Connected')
      : (postCallNotes.trim() ? `No Answer: ${postCallNotes}` : 'No Answer');
    
    const is100List = recruit.stage?.toLowerCase().includes('100') || 
                      recruit.stage?.toLowerCase().includes('list');
    
    logActivityMutation.mutate({
      recruitNotionId: recruit.notionPageId,
      activityType: 'phone_call',
      notes,
      updateLastContact: postCallStatus === 'connected',
    }, {
      onSuccess: async () => {
        toast.success('Call logged');
        setPostCallOpen(false);
        setPostCallStatus(null);
        setPostCallNotes('');
        
        // Invalidate the live activities query for immediate UI update
        queryClient.invalidateQueries({ queryKey: ['recruit-activities', recruit.notionPageId] });
        
        // If connected with someone in 100 List, show stage selection popup
        if (is100List && postCallStatus === 'connected') {
          setList100ConnectedOpen(true);
        } else {
          // Auto-check for stage progression based on metrics
          await checkAndUpdateStage(recruit.notionPageId, recruit.stage);
        }
      },
      onError: () => {
        triggerErrorToast("Couldn't log call - please try again");
        setActivityShake(true);
        setTimeout(() => setActivityShake(false), 500);
      }
    });
  };

  const getActivityIcon = (type: string, notes?: string | null) => {
    // Check if it's a text activity based on notes
    const isText = notes?.toLowerCase().includes('text') || notes?.toLowerCase().startsWith('texted');
    
    if (type === 'phone_call') {
      if (isText) return <MessageSquare className="h-4 w-4 text-blue-500" />;
      if (notes === 'Connected') return <PhoneCall className="h-4 w-4 text-green-500" />;
      if (notes === 'No Answer' || notes === 'Call attempt') return <PhoneMissed className="h-4 w-4 text-muted-foreground" />;
      return <Phone className="h-4 w-4" />;
    }
    switch (type) {
      case 'in_person': return <Users className="h-4 w-4" />;
      case 'note': return <MessageSquare className="h-4 w-4" />;
      case 'next_step': return <Calendar className="h-4 w-4" />;
      case 'stage_change': return <CheckCircle2 className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const handleActivityClick = (activity: RecruitActivity) => {
    setSelectedActivity(activity);
    setEditNotes(activity.notes || '');
    setEditDate(format(parseISO(activity.created_at), 'yyyy-MM-dd'));
    setEditActivityOpen(true);
  };

  const handleUpdateActivity = () => {
    if (!selectedActivity) return;
    
    updateActivityMutation.mutate({
      activityId: selectedActivity.id,
      notes: editNotes,
      createdAt: new Date(editDate).toISOString(),
    }, {
      onSuccess: () => {
        toast.success('Activity updated');
        setEditActivityOpen(false);
        setSelectedActivity(null);
        // Invalidate for immediate UI update
        queryClient.invalidateQueries({ queryKey: ['recruit-activities', recruit.notionPageId] });
      },
      onError: () => {
        triggerErrorToast("Couldn't update activity - please try again");
        setActivityShake(true);
        setTimeout(() => setActivityShake(false), 500);
      }
    });
  };

  const handleDeleteActivity = () => {
    if (!selectedActivity) return;
    
    setIsDeleting(true);
    deleteActivityMutation.mutate(selectedActivity.id, {
      onSuccess: () => {
        toast.success('Activity deleted');
        setDeleteConfirmOpen(false);
        setEditActivityOpen(false);
        setSelectedActivity(null);
        setIsDeleting(false);
        // Invalidate for immediate UI update
        queryClient.invalidateQueries({ queryKey: ['recruit-activities', recruit.notionPageId] });
      },
      onError: () => {
        triggerErrorToast("Couldn't delete activity - please try again");
        setIsDeleting(false);
      }
    });
  };

  // Handle onboarding step change
  const handleOnboardingStepClick = (field: string, label: string, currentValue: boolean) => {
    setPendingOnboardingStep({ field, label, value: !currentValue });
    setOnboardingConfirmOpen(true);
  };

  const handleConfirmOnboardingChange = async () => {
    if (!pendingOnboardingStep || !recruitRepData) return;
    
    const { field, value } = pendingOnboardingStep;
    
    // Map field names to Notion onboarding status values
    const fieldToNotionStatus: Record<string, string> = {
      'onboarding_complete': 'Onboarding ✅',
      'trainings_complete': 'Trainings ✅',
      'slack_joined': 'Slack Joined',
      'ramp_phase_1_complete': 'Phase 1 ✅',
      'ramp_phase_2_complete': 'Phase 2 ✅',
      'ramp_phase_3_complete': 'Phase 3 ✅',
      'ramp_phase_4_complete': 'Phase 4 ✅',
    };
    
    // Map field names to edge function param names for ramp phases
    const fieldToEdgeFunctionParam: Record<string, string> = {
      'ramp_phase_1_complete': 'rampPhase1Complete',
      'ramp_phase_2_complete': 'rampPhase2Complete',
      'ramp_phase_3_complete': 'rampPhase3Complete',
      'ramp_phase_4_complete': 'rampPhase4Complete',
    };
    
    // Optimistic update - immediately update the cache
    queryClient.setQueryData(['recruit-rep-data', recruit.notionPageId], (old: any) => 
      old ? { ...old, [field]: value } : old
    );
    
    setOnboardingConfirmOpen(false);
    setPendingOnboardingStep(null);
    
    try {
      // Update Supabase first
      const { error } = await supabase
        .from('reps')
        .update({ [field]: value })
        .eq('notion_page_id', recruit.notionPageId);
      
      if (error) throw error;
      
      // Then sync to Notion if marking as complete
      if (value) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Build edge function body based on field type
          const edgeBody: Record<string, any> = {
            rookieNotionPageId: recruit.notionPageId,
          };
          
          // For ramp phases, use the checkbox params
          if (fieldToEdgeFunctionParam[field]) {
            edgeBody[fieldToEdgeFunctionParam[field]] = value;
          } else if (fieldToNotionStatus[field]) {
            // For onboarding status fields
            edgeBody.onboardingStatus = fieldToNotionStatus[field];
          }
          
          const { error: notionError } = await supabase.functions.invoke('update-rookie-status', {
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: edgeBody,
          });
          
          if (notionError) {
            console.error('Notion sync error:', notionError);
          } else {
            console.log('Successfully synced to Notion');
          }
        }
      }
      
      toast.success(value ? 'Marked complete' : 'Marked incomplete');
      
      // Invalidate caches for consistency
      queryClient.invalidateQueries({ queryKey: ['recruits-rep-data'] });
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      
      // Check for auto-stage progression
      if (value && field === 'onboarding_complete') {
        await checkAndUpdateStage(recruit.notionPageId, recruit.stage);
      }
    } catch (error) {
      // Revert on error
      queryClient.setQueryData(['recruit-rep-data', recruit.notionPageId], (old: any) => 
        old ? { ...old, [field]: !value } : old
      );
      toast.error("Couldn't update - please try again");
    }
  };

  const getOnboardingStepDescription = (field: string, markingComplete: boolean): string => {
    const action = markingComplete ? 'This confirms that' : 'This will mark that';
    switch (field) {
      case 'onboarding_complete': return `${action} ${recruitFirstName} has finished the initial onboarding steps and is ready to proceed.`;
      case 'trainings_complete': return `${action} ${recruitFirstName} has completed all required training videos and materials.`;
      case 'slack_joined': return `${action} ${recruitFirstName} has joined the team Slack workspace.`;
      case 'ramp_phase_1_complete': return `${action} ${recruitFirstName} has completed Phase 1: Onboard and get ready.`;
      case 'ramp_phase_2_complete': return `${action} ${recruitFirstName} has completed Phase 2: Start training.`;
      case 'ramp_phase_3_complete': return `${action} ${recruitFirstName} has completed Phase 3: Practice.`;
      case 'ramp_phase_4_complete': return `${action} ${recruitFirstName} has completed Phase 4: Saddle up and is blitz-ready!`;
      default: return '';
    }
  };

  const handleMarkCallStatus = (status: 'Connected' | 'No Answer') => {
    if (!selectedActivity) return;
    
    const is100List = recruit.stage?.toLowerCase().includes('100') || 
                      recruit.stage?.toLowerCase().includes('list');
    
    updateActivityMutation.mutate({
      activityId: selectedActivity.id,
      notes: status,
    }, {
      onSuccess: async () => {
        toast.success(`Marked as ${status}`);
        setEditActivityOpen(false);
        setSelectedActivity(null);
        
        // If marked as Connected for 100 List, show stage selection popup
        if (status === 'Connected' && is100List) {
          setList100ConnectedOpen(true);
        }
      },
      onError: () => {
        triggerErrorToast("Couldn't update status - please try again");
        setActivityShake(true);
        setTimeout(() => setActivityShake(false), 500);
      }
    });
  };

  const recruitFirstName = getFirstName(recruit.name);

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90dvh]">
          <DrawerHeader className="border-b">
            <DrawerTitle className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                {stripEmojis(recruit.name)}
                {isStale && (
                  <Badge variant="destructive" className="text-xs">Needs Contact</Badge>
                )}
              </div>
              {/* Show team and recruiter for MGMT/AD leaders only */}
              {isLeaderOfLeaders && (recruit.teamName || recruit.recruiterName) && (
                <div className="flex items-center gap-3 text-xs font-normal text-muted-foreground">
                  {recruit.teamName && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {stripEmojis(recruit.teamName)}
                    </span>
                  )}
                  {recruit.recruiterName && (
                    <span className="flex items-center gap-1">
                      <UserRound className="h-3 w-3" />
                      {stripEmojis(recruit.recruiterName)}
                    </span>
                  )}
                </div>
              )}
            </DrawerTitle>
          </DrawerHeader>

          <div className="p-4 space-y-4 overflow-y-auto">
            {/* Preseason FP+ Goal Progress - always shows FP+ regardless of EFP mode */}
            {recruitGoals?.preseason_fp_goal && recruitGoals.preseason_fp_goal > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Preseason FP+ Goal</span>
                  <span className="text-sm">
                    <span className="font-semibold text-primary">{(recruitYtdFP || 0).toFixed(1)}</span>
                    <span className="text-muted-foreground"> / {recruitGoals.preseason_fp_goal}</span>
                  </span>
                </div>
                <Progress 
                  value={Math.min(((recruitYtdFP || 0) / recruitGoals.preseason_fp_goal) * 100, 100)} 
                  className="h-2"
                />
                {(recruitYtdFP || 0) >= recruitGoals.preseason_fp_goal && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Goal reached!
                  </p>
                )}
              </div>
            )}

            {/* Contact Actions - 3 buttons inline */}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleCall}>
                <Phone className="h-4 w-4 mr-1" />
                Call
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleText}>
                <MessageSquare className="h-4 w-4 mr-1" />
                Text
              </Button>
              {contactForHelp && (
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={handleAskForHelp}
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Text {contactForHelp.name}
                </Button>
              )}
            </div>

            {/* FP+ Display for reps with sales - only show if no preseason goal or different from YTD display */}
            {recruitYtdFP !== undefined && recruitYtdFP > 0 && !(recruitGoals?.preseason_fp_goal && recruitGoals.preseason_fp_goal > 0) && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">YTD FP+</span>
                  <span className="text-lg font-semibold text-emerald-600">
                    {recruitYtdFP.toFixed(1)}
                  </span>
                </div>
                {recruitYtdFP >= 5 && recruit.stage === 'Sold 💲' && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ Has 5+ FP+ - should be "Sold (5+) 💰"
                  </p>
                )}
              </div>
            )}

            {/* Blitz Management Section */}
            <BlitzManagementSection 
              recruit={recruit}
              recruitRepData={recruitRepData}
              queryClient={queryClient}
            />

            {/* iPad Assignment Toggle - only show for pre-blitz rookies */}
            {recruitRepData && (
              (recruitRepData.year === 'Rookie' || !recruitRepData.year) && 
              !recruitRepData.ramp_phase_4_complete
            ) && (
              <div className={`rounded-lg p-3 ${recruitRepData.ipad_assigned ? 'bg-muted/50' : 'bg-amber-500/10 border border-amber-500/30'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tablet className={`h-4 w-4 ${recruitRepData.ipad_assigned ? 'text-muted-foreground' : 'text-amber-600'}`} />
                    <span className={`text-sm ${recruitRepData.ipad_assigned ? 'text-muted-foreground' : 'text-amber-700 font-medium'}`}>
                      {recruitRepData.ipad_assigned ? 'iPad Assigned' : 'No iPad Assigned'}
                    </span>
                  </div>
                  <Switch
                    checked={recruitRepData.ipad_assigned ?? false}
                    onCheckedChange={async (checked) => {
                      // Optimistic update - immediately update the cache
                      queryClient.setQueryData(['recruit-rep-data', recruit.notionPageId], (old: any) => 
                        old ? { ...old, ipad_assigned: checked } : old
                      );
                      
                      try {
                        // Update Supabase
                        const { error: supabaseError } = await supabase
                          .from('reps')
                          .update({ ipad_assigned: checked })
                          .eq('notion_page_id', recruit.notionPageId);
                        
                        if (supabaseError) throw supabaseError;
                        
                        // Sync to Notion via edge function
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session) {
                          await supabase.functions.invoke('update-rookie-status', {
                            headers: { Authorization: `Bearer ${session.access_token}` },
                            body: { rookieNotionPageId: recruit.notionPageId, ipadAssigned: checked },
                          });
                        }
                        
                        toast.success(checked ? 'iPad assigned' : 'iPad unassigned');
                        
                        // Invalidate related queries for consistency
                        queryClient.invalidateQueries({ queryKey: ['recruits-rep-data'] });
                        queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
                      } catch (error) {
                        // Revert on error
                        queryClient.setQueryData(['recruit-rep-data', recruit.notionPageId], (old: any) => 
                          old ? { ...old, ipad_assigned: !checked } : old
                        );
                        toast.error("Couldn't update iPad status");
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* Onboarding Progress - Only for rookies who haven't completed Phase 4 */}
            {recruitRepData && (
              recruitRepData.year === 'Rookie' || !recruitRepData.year
            ) && !recruitRepData.ramp_phase_4_complete && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Onboarding Step Completed</Label>
                <Select 
                  value={
                    recruitRepData.ramp_phase_4_complete ? 'ramp_phase_4_complete' :
                    recruitRepData.ramp_phase_3_complete ? 'ramp_phase_3_complete' :
                    recruitRepData.ramp_phase_2_complete ? 'ramp_phase_2_complete' :
                    recruitRepData.ramp_phase_1_complete ? 'ramp_phase_1_complete' :
                    recruitRepData.slack_joined ? 'slack_joined' :
                    recruitRepData.trainings_complete ? 'trainings_complete' :
                    recruitRepData.onboarding_complete ? 'onboarding_complete' :
                    'none'
                  }
                  onValueChange={(value) => {
                    const stepLabels: Record<string, string> = {
                      'onboarding_complete': 'Onboarding ✅',
                      'trainings_complete': 'Trainings ✅',
                      'slack_joined': 'Slack Joined',
                      'ramp_phase_1_complete': 'Phase 1 ✅',
                      'ramp_phase_2_complete': 'Phase 2 ✅',
                      'ramp_phase_3_complete': 'Phase 3 ✅',
                      'ramp_phase_4_complete': 'Phase 4 ✅',
                    };
                    if (value !== 'none') {
                      handleOnboardingStepClick(value, stepLabels[value] || value, false);
                    }
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select completed step..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not started</SelectItem>
                    <SelectItem value="onboarding_complete">Onboarding ✅</SelectItem>
                    <SelectItem value="trainings_complete">Trainings ✅</SelectItem>
                    <SelectItem value="slack_joined">Slack Joined</SelectItem>
                    <SelectItem value="ramp_phase_1_complete">Phase 1 ✅</SelectItem>
                    <SelectItem value="ramp_phase_2_complete">Phase 2 ✅</SelectItem>
                    <SelectItem value="ramp_phase_3_complete">Phase 3 ✅</SelectItem>
                    <SelectItem value="ramp_phase_4_complete">Phase 4 ✅</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Stage Selector - locked to "Signed" until onboarding complete for rookies */}
            {(() => {
              const isRookie = recruitRepData && (recruitRepData.year === 'Rookie' || !recruitRepData.year);
              const hasCompletedOnboarding = recruitRepData?.onboarding_complete === true;
              const stageLocked = isRookie && !hasCompletedOnboarding;
              const displayedStage = stageLocked ? 'Signed' : recruit.stage;
              
              return (
                <div className={stageShake ? 'animate-shake' : ''}>
                  <Label className="text-sm text-muted-foreground">Stage</Label>
                  <Select 
                    value={displayedStage} 
                    onValueChange={handleStageChange}
                    disabled={stageLocked}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map((stage) => (
                        <SelectItem key={stage} value={stage}>
                          {stage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {stageLocked && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Stage locked until Onboarding ✅ is complete
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Blitz Readiness Warning */}
            {recruitRepData && (() => {
              const committedBlitzes = recruitRepData.committed_blitzes as string[] | null;
              const hasBlitzCommitment = committedBlitzes && committedBlitzes.length > 0;
              const blitzTripDate = recruitRepData.blitz_trip_date ? parseISO(recruitRepData.blitz_trip_date) : null;
              const daysToBlitz = blitzTripDate ? differenceInDays(blitzTripDate, new Date()) : null;
              const isBlitzApproaching = daysToBlitz !== null && daysToBlitz >= 0 && daysToBlitz <= 21;
              
              // Check readiness issues
              const isRampComplete = recruitRepData.ramp_phase_4_complete === true;
              const isOnboardingComplete = recruitRepData.onboarding_complete === true;
              const hasIpad = recruitRepData.ipad_assigned === true;
              
              const hasReadinessIssues = hasBlitzCommitment && isBlitzApproaching && (!isRampComplete || !isOnboardingComplete || !hasIpad);
              
              if (!hasReadinessIssues) return null;
              
              const issues: string[] = [];
              if (!isOnboardingComplete) issues.push('Onboarding incomplete');
              if (!isRampComplete) issues.push('Ramp to Blitz incomplete');
              if (!hasIpad) issues.push('No iPad assigned');
              
              return (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Blitz in {daysToBlitz} days - Not Ready!
                  </div>
                  <ul className="mt-1 text-xs text-destructive/80 list-disc list-inside">
                    {issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            {/* Last Contact Info */}
            {recruit.lastContact && (
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last Contact</span>
                  <span>{format(parseISO(recruit.lastContact), 'MMM d, yyyy')}</span>
                </div>
              </div>
            )}

            {/* Next Action */}
            {recruit.nextAction && (
              <div className="bg-primary/10 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-primary" />
                  Scheduled
                </div>
                <p className="mt-1 text-sm">{recruit.nextAction}</p>
                {recruit.nextActionDue && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Due: {format(parseISO(recruit.nextActionDue), 'MMM d')}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => {
                  setIsDirectSchedule(false);
                  setLogActivityOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Log Activity
              </Button>
              <Button 
                variant="default" 
                className="flex-1 gap-2" 
                onClick={() => {
                  setActivityType('next_step');
                  setNextAction('');
                  setNextActionDue('');
                  setActivityNotes('');
                  setIsDirectSchedule(true);
                  setLogActivityOpen(true);
                }}
              >
                <Calendar className="h-4 w-4" />
                Schedule
              </Button>
            </div>

            {/* Activity Timeline */}
            <div className={activityShake ? 'animate-shake' : ''}>
              <h3 className="text-sm font-medium mb-2">Activity Timeline</h3>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No activities logged yet
                </p>
              ) : (
                <div className="space-y-1">
                  <AnimatePresence mode="popLayout">
                    {(() => {
                      const now = new Date();
                      const oneWeekAgo = subWeeks(now, 1);
                      const oneMonthAgo = subMonths(now, 1);
                      let lastGroup = '';
                      
                      return activities.slice(0, 15).map((activity) => {
                        const activityDate = parseISO(activity.created_at);
                        let currentGroup = '';
                        
                        if (isThisWeek(activityDate, { weekStartsOn: 0 })) {
                          currentGroup = 'This Week';
                        } else if (isAfter(activityDate, oneWeekAgo)) {
                          currentGroup = 'Last Week';
                        } else if (isThisMonth(activityDate)) {
                          currentGroup = 'This Month';
                        } else if (isAfter(activityDate, oneMonthAgo)) {
                          currentGroup = 'Last Month';
                        } else {
                          currentGroup = 'Older';
                        }
                        
                        const showHeader = currentGroup !== lastGroup;
                        lastGroup = currentGroup;
                        
                        return (
                          <div key={activity.id}>
                            {showHeader && (
                              <div className="text-xs font-medium text-muted-foreground pt-3 pb-1 first:pt-0">
                                {currentGroup}
                              </div>
                            )}
                            <motion.div 
                              layout
                              initial={{ opacity: 0, y: -10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9, x: -20 }}
                              transition={{ 
                                type: "spring", 
                                stiffness: 500, 
                                damping: 30,
                                opacity: { duration: 0.2 }
                              }}
                              className="flex gap-3 p-2 -mx-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => handleActivityClick(activity)}
                            >
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                {getActivityIcon(activity.activity_type, activity.notes)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium capitalize">
                                    {activity.activity_type === 'next_step' ? 'Scheduled' : 
                                      activity.notes?.toLowerCase().includes('text') ? 'Text' : 
                                      activity.activity_type.replace('_', ' ')}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {format(activityDate, 'MMM d')}
                                  </span>
                                </div>
                                {activity.notes && (
                                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                                    {activity.notes}
                                  </p>
                                )}
                              </div>
                            </motion.div>
                          </div>
                        );
                      });
                    })()}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Log Activity Drawer - swipe to dismiss */}
      <Drawer open={logActivityOpen} onOpenChange={(open) => {
        setLogActivityOpen(open);
        if (!open) setIsDirectSchedule(false);
      }}>
        <DrawerContent className="max-h-[85dvh] overflow-x-hidden">
          <DrawerHeader>
            <DrawerTitle>{isDirectSchedule ? 'Schedule Follow-up' : 'Log Activity'}</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-4 overflow-y-auto overflow-x-hidden">
            {!isDirectSchedule && (
            <div className="grid grid-cols-3 gap-2">
              {(['phone_call', 'in_person', 'note'] as const).map((type) => (
                <Button
                  key={type}
                  variant={activityType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActivityType(type)}
                  className="flex-col h-auto py-2"
                >
                  {getActivityIcon(type, null)}
                  <span className="text-xs mt-1 capitalize">
                    {type.replace('_', ' ')}
                  </span>
                </Button>
              ))}
            </div>
            )}

            {activityType === 'next_step' ? (
              <>
                {/* Coaching prompt */}
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground italic">
                    "What can I do to help {recruitFirstName} sell 5+ before the summer?"
                  </p>
                </div>
                <div>
                  <Label>What's the next step?</Label>
                  <Input
                    value={nextAction}
                    onChange={(e) => setNextAction(e.target.value)}
                    placeholder="e.g., Follow up about training"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={nextActionDue}
                    onChange={(e) => setNextActionDue(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={activityNotes}
                    onChange={(e) => setActivityNotes(e.target.value)}
                    placeholder="Any additional context..."
                    className="mt-1"
                    rows={2}
                  />
                </div>
              </>
            ) : (
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={activityNotes}
                  onChange={(e) => setActivityNotes(e.target.value)}
                  placeholder="What happened?"
                  className="mt-1"
                  rows={3}
                />
              </div>
            )}

            <Button 
              className="w-full" 
              onClick={handleLogActivity}
              disabled={logActivityMutation.isPending}
            >
              {logActivityMutation.isPending ? 'Saving...' : 'Save Activity'}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Edit Activity Drawer - swipe to dismiss */}
      <Drawer open={editActivityOpen} onOpenChange={setEditActivityOpen}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              Edit Activity
              {selectedActivity && (
                <Badge variant="outline" className="capitalize">
                  {selectedActivity.activity_type === 'next_step' ? 'Scheduled' : selectedActivity.activity_type.replace('_', ' ')}
                </Badge>
              )}
            </DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            {/* Quick status buttons for phone calls */}
            {selectedActivity?.activity_type === 'phone_call' && (
              <div className="flex gap-2">
                <Button
                  variant={editNotes === 'Connected' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => handleMarkCallStatus('Connected')}
                  disabled={updateActivityMutation.isPending}
                >
                  <PhoneCall className="h-4 w-4 mr-2" />
                  Connected
                </Button>
                <Button
                  variant={editNotes === 'No Answer' ? 'secondary' : 'outline'}
                  className="flex-1"
                  onClick={() => handleMarkCallStatus('No Answer')}
                  disabled={updateActivityMutation.isPending}
                >
                  <PhoneMissed className="h-4 w-4 mr-2" />
                  No Answer
                </Button>
              </div>
            )}

            <div>
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full mt-1 justify-start text-left font-normal"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    {editDate ? format(new Date(editDate + 'T12:00:00'), 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={editDate ? new Date(editDate + 'T12:00:00') : undefined}
                    onSelect={(date) => date && setEditDate(format(date, 'yyyy-MM-dd'))}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Activity notes..."
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button 
                className="flex-1" 
                onClick={handleUpdateActivity}
                disabled={updateActivityMutation.isPending}
              >
                {updateActivityMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button 
                variant="destructive"
                size="icon"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Phone Entry Drawer */}
      <Drawer open={phoneEntryOpen} onOpenChange={(open) => {
        setPhoneEntryOpen(open);
        if (!open) {
          setNewPhoneNumber('');
          setPendingPhoneAction(null);
          setPhoneEntryTarget('contact');
        }
      }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {phoneEntryTarget === 'recruit' 
                ? `Add ${recruitFirstName}'s Phone Number`
                : `Add ${contactForHelp?.name}'s Phone Number`
              }
            </DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              {phoneEntryTarget === 'recruit'
                ? `Enter ${recruitFirstName}'s phone number to ${pendingPhoneAction === 'call' ? 'call' : 'text'} them.`
                : `We don't have a phone number for ${contactForHelp?.name}. Enter it below to continue.`
              }
            </p>
            <div>
              <Label>Phone Number</Label>
              <Input
                value={newPhoneNumber}
                onChange={(e) => {
                  // Auto-format phone number as user types
                  const input = e.target.value.replace(/\D/g, '').slice(0, 10);
                  let formatted = '';
                  if (input.length > 0) {
                    formatted = '(' + input.slice(0, 3);
                    if (input.length > 3) {
                      formatted += ') ' + input.slice(3, 6);
                      if (input.length > 6) {
                        formatted += '-' + input.slice(6, 10);
                      }
                    }
                  }
                  setNewPhoneNumber(formatted || input);
                }}
                placeholder="(555) 123-4567"
                type="tel"
                className="mt-1"
                autoFocus
              />
            </div>
            <Button 
              className="w-full"
              onClick={handleSavePhoneAndProceed}
              disabled={savePhoneMutation.isPending || !newPhoneNumber.trim()}
            >
              {savePhoneMutation.isPending ? 'Saving...' : `Save & ${pendingPhoneAction === 'call' ? 'Call' : pendingPhoneAction === 'text' ? 'Text' : 'Continue'}`}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={(open) => !isDeleting && setDeleteConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this activity from the timeline. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteActivity}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stage Change Confirmation */}
      <Drawer open={stageConfirmOpen} onOpenChange={setStageConfirmOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Confirm Stage Change</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium mb-1">
                Move {recruitFirstName} to: <span className="text-primary">{pendingStage}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {pendingStage && getStageDescription(pendingStage)}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setStageConfirmOpen(false);
                  setPendingStage(null);
                }}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1"
                onClick={handleConfirmStageChange}
                disabled={updateStageMutation.isPending}
              >
                {updateStageMutation.isPending ? 'Saving...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Onboarding Step Confirmation */}
      <Drawer open={onboardingConfirmOpen} onOpenChange={setOnboardingConfirmOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Confirm Onboarding Update</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium mb-1">
                Mark as: <span className="text-primary">{pendingOnboardingStep?.label}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {pendingOnboardingStep && getOnboardingStepDescription(pendingOnboardingStep.field, pendingOnboardingStep.value)}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setOnboardingConfirmOpen(false);
                  setPendingOnboardingStep(null);
                }}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1"
                onClick={handleConfirmOnboardingChange}
              >
                Confirm
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Potential Follow Up Drawer - requires next step + date */}
      <Drawer open={potentialFollowUpOpen} onOpenChange={setPotentialFollowUpOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Schedule Follow Up</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              When should we follow up with {recruitFirstName}?
            </p>
            
            <div className="space-y-2">
              <Label>Follow-up Date *</Label>
              <Input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>

            <div className="space-y-2">
              <Label>Next Step *</Label>
              <Textarea
                placeholder="What's the plan for following up?"
                value={followUpNextStep}
                onChange={(e) => setFollowUpNextStep(e.target.value)}
                rows={3}
              />
            </div>

            <Button 
              className="w-full"
              onClick={handleConfirmPotentialFollowUp}
              disabled={logActivityMutation.isPending || updateStageMutation.isPending}
            >
              {logActivityMutation.isPending || updateStageMutation.isPending 
                ? 'Saving...' 
                : 'Mark as Potential Follow Up'}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* 100 List Connected Drawer - pick next stage */}
      <Drawer open={list100ConnectedOpen} onOpenChange={setList100ConnectedOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Great! You connected with {recruitFirstName}</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              How did it go? What's their status now?
            </p>
            
            <Button 
              className="w-full justify-start gap-3 h-14" 
              variant="outline"
              onClick={() => handleList100StageSelect('Evaluating')}
              disabled={updateStageMutation.isPending}
            >
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="text-left">
                <div className="font-medium">Evaluating</div>
                <div className="text-xs text-muted-foreground">Still thinking about it</div>
              </div>
            </Button>

            <Button 
              className="w-full justify-start gap-3 h-14" 
              variant="outline"
              onClick={() => handleList100StageSelect('Signed')}
              disabled={updateStageMutation.isPending}
            >
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <div className="text-left">
                <div className="font-medium">Signed</div>
                <div className="text-xs text-muted-foreground">They're in!</div>
              </div>
            </Button>

            <Button 
              className="w-full justify-start gap-3 h-14" 
              variant="outline"
              onClick={() => handleList100StageSelect('Not Interested')}
              disabled={updateStageMutation.isPending}
            >
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="text-left">
                <div className="font-medium">Not Interested</div>
                <div className="text-xs text-muted-foreground">Not a fit right now</div>
              </div>
            </Button>

            <Button 
              variant="ghost" 
              className="w-full text-muted-foreground"
              onClick={() => setList100ConnectedOpen(false)}
            >
              Decide Later
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Post-Call Logging Drawer - after pressing Call button */}
      <Drawer open={postCallOpen} onOpenChange={setPostCallOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Log Call with {recruitFirstName}</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">How did the call go?</p>
            
            {/* Connected / Attempted toggle */}
            <div className="flex gap-2">
              <Button
                variant={postCallStatus === 'connected' ? 'default' : 'outline'}
                className="flex-1 gap-2"
                onClick={() => setPostCallStatus('connected')}
              >
                <PhoneCall className="h-4 w-4" />
                Connected
              </Button>
              <Button
                variant={postCallStatus === 'attempted' ? 'secondary' : 'outline'}
                className="flex-1 gap-2"
                onClick={() => setPostCallStatus('attempted')}
              >
                <PhoneMissed className="h-4 w-4" />
                Attempted
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder={postCallStatus === 'connected' 
                  ? "e.g., Discussed upcoming blitz, they're excited..." 
                  : "e.g., Left voicemail, will try again tomorrow..."}
                value={postCallNotes}
                onChange={(e) => setPostCallNotes(e.target.value)}
                rows={3}
              />
            </div>

            <Button 
              className="w-full gap-2"
              onClick={handlePostCallSave}
              disabled={logActivityMutation.isPending || !postCallStatus}
            >
              <CheckCircle2 className="h-4 w-4" />
              {logActivityMutation.isPending ? 'Saving...' : 'Save Call'}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
