import { useState } from "react";
import { Recruit, RecruitActivity, useUpdateRecruitStage, useLogRecruitActivity } from "@/hooks/useGroupRecruits";
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
  Plus
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { toast } from "sonner";
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
  const [activityType, setActivityType] = useState<'phone_call' | 'in_person' | 'note' | 'next_step'>('phone_call');
  const [activityNotes, setActivityNotes] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextActionDue, setNextActionDue] = useState('');

  const updateStageMutation = useUpdateRecruitStage();
  const logActivityMutation = useLogRecruitActivity();

  if (!recruit) return null;

  const isStale = recruit.lastContact 
    ? differenceInDays(new Date(), parseISO(recruit.lastContact)) >= 7 
    : true;

  const handleCall = async () => {
    // Auto-log call attempt
    try {
      await logActivityMutation.mutateAsync({
        recruitNotionId: recruit.notionPageId,
        activityType: 'phone_call',
        notes: 'Call attempt',
        updateLastContact: true,
      });
      toast.success('Call logged');
    } catch (error) {
      console.error('Failed to log call:', error);
    }
    window.location.href = `tel:${recruit.phone}`;
  };

  const handleText = async () => {
    // Auto-log text attempt
    try {
      await logActivityMutation.mutateAsync({
        recruitNotionId: recruit.notionPageId,
        activityType: 'phone_call',
        notes: 'Text sent',
        updateLastContact: true,
      });
      toast.success('Text logged');
    } catch (error) {
      console.error('Failed to log text:', error);
    }
    window.location.href = `sms:${recruit.phone}`;
  };

  const handleStageChange = async (newStage: string) => {
    try {
      await updateStageMutation.mutateAsync({
        recruitNotionId: recruit.notionPageId,
        newStage,
      });
      toast.success(`Moved to ${newStage}`);
    } catch (error) {
      toast.error('Failed to update stage');
    }
  };

  const handleLogActivity = async () => {
    if (!activityNotes && activityType !== 'next_step') {
      toast.error('Please add some notes');
      return;
    }

    try {
      await logActivityMutation.mutateAsync({
        recruitNotionId: recruit.notionPageId,
        activityType,
        notes: activityNotes,
        nextAction: activityType === 'next_step' ? nextAction : undefined,
        nextActionDue: activityType === 'next_step' ? nextActionDue : undefined,
        updateLastContact: activityType === 'phone_call' || activityType === 'in_person',
      });
      toast.success('Activity logged');
      setLogActivityOpen(false);
      setActivityNotes('');
      setNextAction('');
      setNextActionDue('');
    } catch (error) {
      toast.error('Failed to log activity');
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'phone_call': return <Phone className="h-4 w-4" />;
      case 'in_person': return <Users className="h-4 w-4" />;
      case 'note': return <MessageSquare className="h-4 w-4" />;
      case 'next_step': return <Calendar className="h-4 w-4" />;
      case 'stage_change': return <CheckCircle2 className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="border-b">
            <DrawerTitle className="flex items-center gap-2">
              {recruit.name}
              {isStale && (
                <Badge variant="destructive" className="text-xs">Needs Contact</Badge>
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
            <div>
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
            <div>
              <h3 className="text-sm font-medium mb-2">Activity Timeline</h3>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No activities logged yet
                </p>
              ) : (
                <div className="space-y-3">
                  {activities.slice(0, 10).map((activity) => (
                    <div key={activity.id} className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        {getActivityIcon(activity.activity_type)}
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
                    </div>
                  ))}
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
                  {getActivityIcon(type)}
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
    </>
  );
};
