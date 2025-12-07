import { useState, useMemo } from "react";
import { Recruit, RecruitActivity, useUpdateRecruitStage, useLogRecruitActivity, useUpdateRecruitActivity, useDeleteRecruitActivity } from "@/hooks/useGroupRecruits";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertCircle
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
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

interface RecruitDetailDrawerProps {
  recruit: Recruit | null;
  activities: RecruitActivity[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RecruitDetailDrawer = ({ 
  recruit, 
  activities, 
  open, 
  onOpenChange 
}: RecruitDetailDrawerProps) => {
  const [logActivityOpen, setLogActivityOpen] = useState(false);
  const [editActivityOpen, setEditActivityOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [phoneEntryOpen, setPhoneEntryOpen] = useState(false);
  const [potentialFollowUpOpen, setPotentialFollowUpOpen] = useState(false);
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
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  
  // Error shake state
  const [stageShake, setStageShake] = useState(false);
  const [activityShake, setActivityShake] = useState(false);

  const updateStageMutation = useUpdateRecruitStage();
  const logActivityMutation = useLogRecruitActivity();
  const updateActivityMutation = useUpdateRecruitActivity();
  const deleteActivityMutation = useDeleteRecruitActivity();
  const { data: teamAccess } = useTeamAccess();
  const queryClient = useQueryClient();

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

  // Save phone number mutation
  const savePhoneMutation = useMutation({
    mutationFn: async ({ notionPageId, phone }: { notionPageId: string; phone: string }) => {
      // Update in Supabase
      const { error } = await supabase
        .from('reps')
        .update({ phone })
        .eq('notion_page_id', notionPageId);
      
      if (error) throw error;
      
      // TODO: Also sync to Notion if needed
      return { phone };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-for-help'] });
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
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
      toast.error('No phone number available');
      return;
    }
    logActivityMutation.mutate({
      recruitNotionId: recruit.notionPageId,
      activityType: 'phone_call',
      notes: 'Call attempt',
      updateLastContact: true,
    }, {
      onError: () => {
        triggerErrorToast("Couldn't save call - please try again");
        setActivityShake(true);
        setTimeout(() => setActivityShake(false), 500);
      }
    });
    toast.success('Call logged');
    window.location.href = `tel:${recruit.phone}`;
  };

  const handleText = async () => {
    if (!recruit.phone) {
      toast.error('No phone number available');
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
      setPhoneEntryOpen(true);
      return;
    }
    
    const encodedMessage = encodeURIComponent(helpMessage);
    window.location.href = `sms:${contactForHelp.phone}?body=${encodedMessage}`;
  };

  const handleSavePhoneAndProceed = () => {
    if (!newPhoneNumber.trim() || !contactForHelp?.notionPageId) {
      toast.error('Please enter a phone number');
      return;
    }
    
    savePhoneMutation.mutate({
      notionPageId: contactForHelp.notionPageId,
      phone: newPhoneNumber.trim(),
    }, {
      onSuccess: () => {
        setPhoneEntryOpen(false);
        setNewPhoneNumber('');
        
        // Now proceed with the original action
        if (pendingPhoneAction === 'ask_help') {
          const encodedMessage = encodeURIComponent(helpMessage);
          window.location.href = `sms:${newPhoneNumber.trim()}?body=${encodedMessage}`;
        }
        setPendingPhoneAction(null);
      }
    });
  };

  const handleStageChange = (newStage: string) => {
    // Require next step + date for Potential Follow Up
    if (newStage === 'Potential Follow Up') {
      setPotentialFollowUpOpen(true);
      return;
    }
    
    updateStageMutation.mutate({
      recruitNotionId: recruit.notionPageId,
      newStage,
    }, {
      onSuccess: () => {
        toast.success(`Moved to ${newStage}`);
      },
      onError: () => {
        triggerErrorToast("Couldn't update stage - please try again");
        setStageShake(true);
        setTimeout(() => setStageShake(false), 500);
      }
    });
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

  const handleLogActivity = () => {
    if (!activityNotes && activityType !== 'next_step') {
      toast.error('Please add some notes');
      return;
    }

    logActivityMutation.mutate({
      recruitNotionId: recruit.notionPageId,
      activityType,
      notes: activityNotes,
      nextAction: activityType === 'next_step' ? nextAction : undefined,
      nextActionDue: activityType === 'next_step' ? nextActionDue : undefined,
      updateLastContact: activityType === 'phone_call' || activityType === 'in_person',
    }, {
      onSuccess: () => {
        toast.success('Activity logged');
        setLogActivityOpen(false);
        setActivityNotes('');
        setNextAction('');
        setNextActionDue('');
      },
      onError: () => {
        triggerErrorToast("Couldn't save activity - please try again");
        setActivityShake(true);
        setTimeout(() => setActivityShake(false), 500);
      }
    });
  };

  const getActivityIcon = (type: string, notes?: string | null) => {
    if (type === 'phone_call') {
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
    
    deleteActivityMutation.mutate(selectedActivity.id, {
      onSuccess: () => {
        toast.success('Activity deleted');
        setDeleteConfirmOpen(false);
        setEditActivityOpen(false);
        setSelectedActivity(null);
      },
      onError: () => {
        triggerErrorToast("Couldn't delete activity - please try again");
      }
    });
  };

  const handleMarkCallStatus = (status: 'Connected' | 'No Answer') => {
    if (!selectedActivity) return;
    
    updateActivityMutation.mutate({
      activityId: selectedActivity.id,
      notes: status,
    }, {
      onSuccess: () => {
        toast.success(`Marked as ${status}`);
        setEditActivityOpen(false);
        setSelectedActivity(null);
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
        <DrawerContent className="max-h-[90vh]">
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

            {/* Stage Selector */}
            <div className={stageShake ? 'animate-shake' : ''}>
              <Label className="text-sm text-muted-foreground">Stage</Label>
              <Select value={recruit.stage} onValueChange={handleStageChange}>
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
            </div>

            {/* Contact Info */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Phone</span>
                <a href={`tel:${recruit.phone}`} className="text-primary">
                  {recruit.phone || 'Not set'}
                </a>
              </div>
              {recruit.email && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span>{recruit.email}</span>
                </div>
              )}
              {recruit.lastContact && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last Contact</span>
                  <span>{format(parseISO(recruit.lastContact), 'MMM d, yyyy')}</span>
                </div>
              )}
            </div>

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

            {/* Log Activity Button */}
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => setLogActivityOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Log Activity
            </Button>

            {/* Activity Timeline */}
            <div className={activityShake ? 'animate-shake' : ''}>
              <h3 className="text-sm font-medium mb-2">Activity Timeline</h3>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No activities logged yet
                </p>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {activities.slice(0, 10).map((activity) => (
                      <motion.div 
                        key={activity.id}
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
                              {activity.activity_type === 'next_step' ? 'Scheduled' : activity.activity_type.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(activity.created_at), 'MMM d')}
                            </span>
                          </div>
                          {activity.notes && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {activity.notes}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Log Activity Drawer - swipe to dismiss */}
      <Drawer open={logActivityOpen} onOpenChange={setLogActivityOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Log Activity</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-4 gap-2">
              {(['phone_call', 'in_person', 'note', 'next_step'] as const).map((type) => (
                <Button
                  key={type}
                  variant={activityType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActivityType(type)}
                  className="flex-col h-auto py-2"
                >
                  {getActivityIcon(type, null)}
                  <span className="text-xs mt-1 capitalize">
                    {type === 'next_step' ? 'Schedule' : type.replace('_', ' ')}
                  </span>
                </Button>
              ))}
            </div>

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
        <DrawerContent className="max-h-[85vh]">
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
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="mt-1"
              />
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
      <Drawer open={phoneEntryOpen} onOpenChange={setPhoneEntryOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Enter Phone Number</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              We don't have a phone number for {contactForHelp?.name}. Enter it below to continue.
            </p>
            <div>
              <Label>Phone Number</Label>
              <Input
                value={newPhoneNumber}
                onChange={(e) => setNewPhoneNumber(e.target.value)}
                placeholder="(555) 123-4567"
                type="tel"
                className="mt-1"
              />
            </div>
            <Button 
              className="w-full"
              onClick={handleSavePhoneAndProceed}
              disabled={savePhoneMutation.isPending || !newPhoneNumber.trim()}
            >
              {savePhoneMutation.isPending ? 'Saving...' : 'Save & Continue'}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this activity from the timeline. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteActivity}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    </>
  );
};
