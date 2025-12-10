import { useState } from "react";
import { LayoutGrid, Sun } from "lucide-react";
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
import { Recruit, RecruitActivity } from "@/hooks/useGroupRecruits";

type ViewMode = 'board' | 'availability';

interface QuickViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruits: Recruit[];
  activities: RecruitActivity[];
}

const getDrawerTitle = (viewMode: ViewMode) => {
  return viewMode === 'availability' ? 'Summer Availability' : 'All Recruits';
};

export const QuickViewDrawer = ({ 
  open, 
  onOpenChange, 
  recruits,
  activities 
}: QuickViewDrawerProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('board');

  const showBadge = viewMode === 'board';

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
          ) : (
            <SummerAvailabilityView />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
