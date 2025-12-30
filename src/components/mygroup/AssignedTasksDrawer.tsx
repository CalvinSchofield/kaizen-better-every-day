import { useState } from "react";
import { format, parseISO, isPast, isToday } from "date-fns";
import { CheckCircle2, Calendar, User, Loader2, Clock, AlertCircle } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AssignedTask, useCompleteTask } from "@/hooks/useAssignedTasks";
import { toast } from "sonner";

interface AssignedTasksDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: AssignedTask[];
  onRecruitClick?: (notionPageId: string) => void;
}

// Strip emojis from name
const stripEmojis = (text: string | null): string | null => {
  if (!text) return null;
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
};

export const AssignedTasksDrawer = ({
  open,
  onOpenChange,
  tasks,
  onRecruitClick,
}: AssignedTasksDrawerProps) => {
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState<string>('');
  const [showCompletionForm, setShowCompletionForm] = useState<string | null>(null);
  
  const completeTaskMutation = useCompleteTask();

  const handleComplete = async (taskId: string) => {
    try {
      await completeTaskMutation.mutateAsync({ 
        taskId,
        notes: completionNotes || undefined,
      });
      toast.success('Task marked as complete');
      setShowCompletionForm(null);
      setCompletionNotes('');
    } catch (error) {
      console.error('Failed to complete task:', error);
      toast.error('Failed to complete task');
    }
  };

  const getDueStatus = (dueDate: string | null) => {
    if (!dueDate) return null;
    const date = parseISO(dueDate);
    if (isPast(date) && !isToday(date)) return 'overdue';
    if (isToday(date)) return 'today';
    return 'upcoming';
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerHeader className="border-b">
          <DrawerTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Assigned to Me ({tasks.length})
          </DrawerTitle>
        </DrawerHeader>

        <div className="overflow-y-auto p-4 space-y-3">
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No tasks assigned to you</p>
            </div>
          ) : (
            tasks.map((task) => {
              const dueStatus = getDueStatus(task.next_action_due);
              const recruitName = stripEmojis(task.recruit?.name) || 'Unknown Recruit';
              
              return (
                <div 
                  key={task.id}
                  className="bg-card border rounded-xl p-4 space-y-3"
                >
                  {/* Header with recruit name */}
                  <div className="flex items-start justify-between gap-2">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => {
                        if (task.recruit && onRecruitClick) {
                          onRecruitClick(task.recruit_id);
                          onOpenChange(false);
                        }
                      }}
                    >
                      <p className="font-medium text-foreground hover:underline">
                        {recruitName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {task.recruit?.stage || 'Unknown stage'}
                      </p>
                    </div>
                    
                    {dueStatus && (
                      <Badge 
                        variant="outline"
                        className={cn(
                          "shrink-0",
                          dueStatus === 'overdue' && "bg-red-500/10 text-red-600 border-red-500/30",
                          dueStatus === 'today' && "bg-amber-500/10 text-amber-600 border-amber-500/30",
                          dueStatus === 'upcoming' && "bg-blue-500/10 text-blue-600 border-blue-500/30"
                        )}
                      >
                        {dueStatus === 'overdue' && <AlertCircle className="h-3 w-3 mr-1" />}
                        {dueStatus === 'today' && <Clock className="h-3 w-3 mr-1" />}
                        {task.next_action_due && format(parseISO(task.next_action_due), 'MMM d')}
                      </Badge>
                    )}
                  </div>

                  {/* Task description */}
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm">
                      {task.next_action || task.notes || 'No description'}
                    </p>
                  </div>

                  {/* Assigned by */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>Assigned by {task.assignedByName}</span>
                    <span>•</span>
                    <Calendar className="h-3 w-3" />
                    <span>{format(parseISO(task.created_at), 'MMM d')}</span>
                  </div>

                  {/* Actions */}
                  {showCompletionForm === task.id ? (
                    <div className="space-y-2 pt-2 border-t">
                      <Textarea
                        value={completionNotes}
                        onChange={(e) => setCompletionNotes(e.target.value)}
                        placeholder="Add completion notes (optional)"
                        rows={2}
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleComplete(task.id)}
                          disabled={completeTaskMutation.isPending}
                          className="flex-1"
                        >
                          {completeTaskMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Mark Complete
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowCompletionForm(null);
                            setCompletionNotes('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowCompletionForm(task.id)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Complete Task
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
