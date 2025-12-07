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
  AlertCircle,
  HelpCircle
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
  'Reached Out',
  'Evaluating',
  'Signed',
  'Shadow ✅',
  'Sold 💲',
  'Sold (5+) 💰',
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

  // Get leader/recruiter phone number for the "Ask for Help" button
  const { data: contactForHelp } = useQuery({
    queryKey: ['contact-for-help', recruit?.recruiterName, recruit?.teamName],
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
        name: stripEmojis(repData.name),
        phone: repData.phone,
        notionPageId: repData.notion_page_id,
        role,
      };
    },
    enabled: !!recruit && open,
  });

  // Check if current user is a leader of leaders (MGMT or AD)
  const isLeaderOfLeaders = teamAccess?.accessLevel === 'mgmt_group_lead' || 
                            teamAccess?.accessLevel === 'area_director';

  // Generate context-aware help message
  const helpMessage = useMemo(() => {
    if (!recruit || !contactForHelp) return '';
    
    const recruitFirstName = getFirstName(recruit.name);
    const daysSinceContact = recruit.lastContact 
      ? differenceInDays(new Date(), parseISO(recruit.lastContact))
      : null;
    
    // Check various conditions and generate appropriate message
    const stage = recruit.stage?.toLowerCase() || '';
    
    // 100 List - need introduction
    if (stage.includes('100') || stage.includes('list')) {
      return `Hey! I'm looking at ${recruitFirstName} on the list. Could you give me an intro or let me know how I can help reach out?`;
    }
    
    // Reached Out / Evaluating - follow up
    if (stage.includes('reached') || stage.includes('evaluating')) {
      if (daysSinceContact && daysSinceContact > 7) {
        return `Hey! It's been ${daysSinceContact} days since we last touched base with ${recruitFirstName}. Any ideas on how to re-engage them?`;
      }
      return `Hey! How can I help move ${recruitFirstName} forward? What's holding them back from signing?`;
    }
    
    // Signed but no blitz commitments
    if (stage.includes('signed')) {
      return `Hey! ${recruitFirstName} is signed but I don't see them committed to any blitzes yet. Can we get them on a trip? How can I help?`;
    }
    
    // Shadow complete but not sold yet
    if (stage.includes('shadow')) {
      return `Hey! ${recruitFirstName} has shadowed - how can I help them get their first sale? Any specific areas they need coaching on?`;
    }
    
    // Sold but not at 5+
    if (stage.includes('sold') && !stage.includes('5+')) {
      return `Hey! ${recruitFirstName} has a sale under their belt. What can I do to help them hit 5+ before summer?`;
    }
    
    // Generic stale contact
    if (daysSinceContact && daysSinceContact > 14) {
      return `Hey! It's been a while since we've connected with ${recruitFirstName}. How can I help get them re-engaged?`;
    }
    
    // Default helpful message
    return `Hey! What can I do to help ${recruitFirstName} sell 5+ before the summer?`;
  }, [recruit, contactForHelp]);

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
            {/* Contact Actions */}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleCall}>
                <Phone className="h-4 w-4 mr-2" />
                Call
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleText}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Text
              </Button>
            </div>

            {/* Ask for Help Button - context-aware */}
            {contactForHelp && (
              <Button 
                variant="secondary" 
                className="w-full"
                onClick={handleAskForHelp}
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Ask {contactForHelp.name} for Help
              </Button>
            )}

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
    </>
  );
};
