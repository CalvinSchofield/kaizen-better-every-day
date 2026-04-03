import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Users } from "lucide-react";
import { OrgGroupedRepList, type OrgRepData } from "@/components/reports/OrgGroupedRepList";
import type { AccessLevel } from "@/utils/roleHierarchy";

interface WorkingRepData {
  userId: string;
  name: string;
  year?: string;
  timezone?: string;
  teamId?: string | null;
  teamName?: string | null;
  mgmtGroupId?: string | null;
  mgmtGroupName?: string | null;
  recruiterName?: string | null;
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
  pendingFp?: number;
  pendingPrmr?: number;
  isWorking: boolean;
}

interface WorkingRepsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reps: WorkingRepData[];
  periodLabel: string;
  isLiveView?: boolean;
  onRepClick?: (userId: string) => void;
  accessLevel?: AccessLevel;
}

export const WorkingRepsDrawer = ({
  open,
  onOpenChange,
  reps,
  periodLabel,
  isLiveView,
  onRepClick,
  accessLevel = 'team_lead',
}: WorkingRepsDrawerProps) => {
  // Convert to OrgRepData format
  const orgReps: OrgRepData[] = reps.map(rep => ({
    userId: rep.userId,
    name: rep.name,
    year: rep.year,
    teamId: rep.teamId,
    teamName: rep.teamName,
    mgmtGroupId: rep.mgmtGroupId,
    mgmtGroupName: rep.mgmtGroupName,
    recruiterName: rep.recruiterName,
    fp: rep.fp,
    prmr: rep.prmr,
    doors: rep.doors,
    presentations: rep.presentations,
    transitions: rep.transitions,
    pitches: 0,
    hoursWorked: rep.hoursWorked,
    isWorking: rep.isWorking,
  }));

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
          <OrgGroupedRepList
            reps={orgReps}
            accessLevel={accessLevel}
            onRepClick={onRepClick}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
};
