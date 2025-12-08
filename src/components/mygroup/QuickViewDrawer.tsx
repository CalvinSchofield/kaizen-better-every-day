import { useState } from "react";
import { LayoutGrid, List, CalendarDays, ClipboardCheck, Plane, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle 
} from "@/components/ui/drawer";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecruitKanbanBoard } from "./RecruitKanbanBoard";
import { RecruitListView } from "./RecruitListView";
import { RecruitPlannerView } from "./RecruitPlannerView";
import { RecruitReadinessView } from "./RecruitReadinessView";
import { PreseasonCommitmentsView } from "./PreseasonCommitmentsView";
import { SummerAvailabilityView } from "./SummerAvailabilityView";
import { Recruit, RecruitActivity } from "@/hooks/useGroupRecruits";

type ViewMode = 'board' | 'list' | 'planner' | 'readiness' | 'preseason' | 'availability';

interface QuickViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruits: Recruit[];
  activities: RecruitActivity[];
}

const getDrawerTitle = (viewMode: ViewMode) => {
  switch (viewMode) {
    case 'readiness': return 'Team Readiness';
    case 'preseason': return 'Preseason Commitments';
    case 'availability': return 'Summer Availability';
    default: return 'All Recruits';
  }
};

export const QuickViewDrawer = ({ 
  open, 
  onOpenChange, 
  recruits,
  activities 
}: QuickViewDrawerProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('board');

  const showBadge = ['board', 'list', 'planner'].includes(viewMode);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
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
                <TabsTrigger value="list" className="px-2" title="List">
                  <List className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="planner" className="px-2" title="Planner">
                  <CalendarDays className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="readiness" className="px-2" title="Readiness">
                  <ClipboardCheck className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="preseason" className="px-2" title="Preseason">
                  <Plane className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="availability" className="px-2" title="Availability">
                  <Sun className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </DrawerHeader>
        
        <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          {viewMode === 'board' ? (
            <RecruitKanbanBoard recruits={recruits} activities={activities} />
          ) : viewMode === 'list' ? (
            <RecruitListView recruits={recruits} activities={activities} />
          ) : viewMode === 'planner' ? (
            <RecruitPlannerView recruits={recruits} activities={activities} />
          ) : viewMode === 'readiness' ? (
            <RecruitReadinessView />
          ) : viewMode === 'preseason' ? (
            <PreseasonCommitmentsView />
          ) : (
            <SummerAvailabilityView />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
