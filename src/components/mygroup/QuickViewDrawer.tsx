import { useState } from "react";
import { LayoutGrid, List, CalendarDays, ClipboardCheck } from "lucide-react";
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
import { Recruit, RecruitActivity } from "@/hooks/useGroupRecruits";

interface QuickViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruits: Recruit[];
  activities: RecruitActivity[];
}

export const QuickViewDrawer = ({ 
  open, 
  onOpenChange, 
  recruits,
  activities 
}: QuickViewDrawerProps) => {
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'planner' | 'readiness'>('board');

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <DrawerTitle className="flex items-center gap-2">
              {viewMode === 'readiness' ? 'Team Readiness' : 'All Recruits'}
              {viewMode !== 'readiness' && (
                <Badge variant="secondary">{recruits.length}</Badge>
              )}
            </DrawerTitle>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'board' | 'list' | 'planner' | 'readiness')}>
              <TabsList className="h-8">
                <TabsTrigger value="board" className="px-2">
                  <LayoutGrid className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="list" className="px-2">
                  <List className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="planner" className="px-2">
                  <CalendarDays className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="readiness" className="px-2">
                  <ClipboardCheck className="h-4 w-4" />
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
          ) : (
            <RecruitReadinessView />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
