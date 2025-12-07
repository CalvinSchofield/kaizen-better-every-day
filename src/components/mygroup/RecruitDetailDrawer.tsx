import { useState, useRef } from "react";
import { Recruit, RecruitActivity, useUpdateRecruitStage, useLogRecruitActivity, useUpdateRecruitActivity, useDeleteRecruitActivity } from "@/hooks/useGroupRecruits";
import { useTeamAccess } from "@/hooks/useTeamAccess";
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
  ChevronDown,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  const [selectedActivity, setSelectedActivity] = useState<RecruitActivity | null>(null);
  const [activityType, setActivityType] = useState<'phone_call' | 'in_person' | 'note' | 'next_step'>('phone_call');
  const [activityNotes, setActivityNotes] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextActionDue, setNextActionDue] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDate, setEditDate] = useState('');
  
  // Error shake state
  const [stageShake, setStageShake] = useState(false);
  const [activityShake, setActivityShake] = useState(false);

  const updateStageMutation = useUpdateRecruitStage();
  const logActivityMutation = useLogRecruitActivity();
  const updateActivityMutation = useUpdateRecruitActivity();
  const deleteActivityMutation = useDeleteRecruitActivity();
  const { data: teamAccess } = useTeamAccess();

  // Check if current user is a leader of leaders (MGMT or AD)
  const isLeaderOfLeaders = teamAccess?.accessLevel === 'mgmt_group_lead' || 
                            teamAccess?.accessLevel === 'area_director';

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
    // Auto-log call attempt - optimistic, so show success immediately
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
    // Auto-log text attempt - optimistic
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
                  {recruit.phone}
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
                  Next Step
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
                              {activity.activity_type.replace('_', ' ')}
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

      {/* Log Activity Sheet */}
      <Sheet open={logActivityOpen} onOpenChange={setLogActivityOpen}>
        <SheetContent side="bottom" className="h-auto">
          <SheetHeader>
            <SheetTitle>Log Activity</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
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
                    {type.replace('_', ' ')}
                  </span>
                </Button>
              ))}
            </div>

            {activityType === 'next_step' ? (
              <>
                <div>
                  <Label>Next Step</Label>
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
        </SheetContent>
      </Sheet>

      {/* Edit Activity Sheet */}
      <Sheet open={editActivityOpen} onOpenChange={setEditActivityOpen}>
        <SheetContent side="bottom" className="h-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              Edit Activity
              {selectedActivity && (
                <Badge variant="outline" className="capitalize">
                  {selectedActivity.activity_type.replace('_', ' ')}
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
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
        </SheetContent>
      </Sheet>

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
