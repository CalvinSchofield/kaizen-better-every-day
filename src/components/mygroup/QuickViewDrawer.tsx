import { useState } from "react";
import { LayoutGrid, Sun, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle 
} from "@/components/ui/drawer";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecruitKanbanBoard } from "./RecruitKanbanBoard";
import { SummerAvailabilityView } from "./SummerAvailabilityView";
import { OrganizationManagementView } from "./OrganizationManagementView";
import { Recruit, RecruitActivity } from "@/hooks/useGroupRecruits";
import { useTeamAccess } from "@/hooks/useTeamAccess";

type ViewMode = 'board' | 'availability' | 'org';

interface QuickViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruits: Recruit[];
  activities: RecruitActivity[];
}

const getDrawerTitle = (viewMode: ViewMode) => {
  switch (viewMode) {
    case 'availability':
      return 'Summer Availability';
    case 'org':
      return 'Organization';
    default:
      return 'All Recruits';
  }
};

export const QuickViewDrawer = ({ 
  open, 
  onOpenChange, 
  recruits,
  activities 
}: QuickViewDrawerProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const { data: teamAccess } = useTeamAccess();

  const isAreaDirector = teamAccess?.accessLevel === 'area_director';
  const showBadge = viewMode === 'board';

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <DrawerTitle className="flex items-center gap-2">
              {getDrawerTitle(viewMode)}
              {showBadge && (
                <Badge variant="secondary">{recruits.length}</Badge>
              )}
            </DrawerTitle>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList className="h-8">
                <TabsTrigger value="board" className="px-2" title="Board">
                  <LayoutGrid className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="availability" className="px-2" title="Availability">
                  <Sun className="h-4 w-4" />
                </TabsTrigger>
                {isAreaDirector && (
                  <TabsTrigger value="org" className="px-2" title="Organization">
                    <Building2 className="h-4 w-4" />
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
          </div>
        </DrawerHeader>
        
        <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          {viewMode === 'board' ? (
            <RecruitKanbanBoard recruits={recruits} activities={activities} />
          ) : viewMode === 'availability' ? (
            <SummerAvailabilityView />
          ) : (
            <OrganizationManagementView />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
