import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Users } from "lucide-react";
import { HierarchicalRepList } from "./HierarchicalRepList";

interface WorkingRepData {
  userId: string;
  name: string;
  year?: string;
  timezone?: string;
  teamId?: string | null;
  teamName?: string | null;
  recruiterName?: string | null; // For organic hierarchy grouping
  workStartTime?: string;
  workEndTime?: string;
  avgStartTime?: string;
  avgEndTime?: string;
  hoursWorked: number;
  doors: number;
  transitions: number;
  presentations: number;
  fp: number;
  prmr: number;
  isWorking: boolean;
}

interface WorkingRepsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reps: WorkingRepData[];
  periodLabel: string;
  isLiveView?: boolean;
  onRepClick?: (userId: string) => void;
}

export const WorkingRepsDrawer = ({
  open,
  onOpenChange,
  reps,
  periodLabel,
  isLiveView,
  onRepClick,
}: WorkingRepsDrawerProps) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {isLiveView ? 'Working Today' : periodLabel}
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="px-4 pb-6 overflow-y-auto">
          <HierarchicalRepList
            reps={reps}
            periodLabel={periodLabel}
            isLiveView={isLiveView}
            onRepClick={onRepClick}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
};