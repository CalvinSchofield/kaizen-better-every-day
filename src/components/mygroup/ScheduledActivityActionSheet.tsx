import { useState } from "react";
import { Check, Calendar, Trash2, Phone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { RecruitActivity } from "@/hooks/useGroupRecruits";

interface ScheduledActivityActionSheetProps {
  activity: RecruitActivity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkComplete: (activity: RecruitActivity, completedType: 'phone_call' | 'in_person') => void;
  onReschedule: (activity: RecruitActivity) => void;
  onDelete: (activity: RecruitActivity) => void;
}

export const ScheduledActivityActionSheet = ({
  activity,
  open,
  onOpenChange,
  onMarkComplete,
  onReschedule,
  onDelete,
}: ScheduledActivityActionSheetProps) => {
  const [showTypeSelection, setShowTypeSelection] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setShowTypeSelection(false);
    }
    onOpenChange(newOpen);
  };

  const handleMarkCompleteClick = () => {
    setShowTypeSelection(true);
  };

  const handleTypeSelect = (type: 'phone_call' | 'in_person') => {
    if (activity) {
      onMarkComplete(activity, type);
      setShowTypeSelection(false);
      onOpenChange(false);
    }
  };

  const handleReschedule = () => {
    if (activity) {
      onReschedule(activity);
      onOpenChange(false);
    }
  };

  const handleDelete = () => {
    if (activity) {
      onDelete(activity);
      onOpenChange(false);
    }
  };

  if (!activity) return null;

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-center">
            {showTypeSelection ? "How did you complete it?" : "What would you like to do?"}
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="p-4 space-y-3">
          {/* Show scheduled activity preview */}
          {!showTypeSelection && (
            <div className="bg-muted/50 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium line-clamp-2">
                {activity.notes || activity.next_action || "Scheduled follow-up"}
              </p>
              {activity.next_action_due && (
                <p className="text-xs text-muted-foreground mt-1">
                  Due: {new Date(activity.next_action_due).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {showTypeSelection ? (
            // Type selection view
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start h-14 text-left"
                onClick={() => handleTypeSelect('phone_call')}
              >
                <Phone className="h-5 w-5 mr-3 text-green-500" />
                <div>
                  <div className="font-medium">Phone Call</div>
                  <div className="text-xs text-muted-foreground">Completed via call</div>
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-start h-14 text-left"
                onClick={() => handleTypeSelect('in_person')}
              >
                <Users className="h-5 w-5 mr-3 text-purple-500" />
                <div>
                  <div className="font-medium">In Person</div>
                  <div className="text-xs text-muted-foreground">Met face to face</div>
                </div>
              </Button>
              
              <Button
                variant="ghost"
                className="w-full mt-2"
                onClick={() => setShowTypeSelection(false)}
              >
                Back
              </Button>
            </div>
          ) : (
            // Main actions view
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start h-14 text-left"
                onClick={handleMarkCompleteClick}
              >
                <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center mr-3">
                  <Check className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <div className="font-medium">Mark Complete</div>
                  <div className="text-xs text-muted-foreground">Log as completed activity</div>
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-start h-14 text-left"
                onClick={handleReschedule}
              >
                <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center mr-3">
                  <Calendar className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <div className="font-medium">Reschedule</div>
                  <div className="text-xs text-muted-foreground">Pick a new date</div>
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-start h-14 text-left text-destructive hover:text-destructive"
                onClick={handleDelete}
              >
                <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center mr-3">
                  <Trash2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-medium">Delete</div>
                  <div className="text-xs text-muted-foreground/70">Remove this scheduled item</div>
                </div>
              </Button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
