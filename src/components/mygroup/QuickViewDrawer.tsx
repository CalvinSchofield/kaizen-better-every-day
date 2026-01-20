import { useState, useEffect } from "react";
import { LayoutGrid, Sun, Building2, Bell, Target } from "lucide-react";
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
import { ActivityDigestView } from "./ActivityDigestView";
import { GoalsTabView } from "./GoalsTabView";
import { Recruit, RecruitActivity } from "@/hooks/useGroupRecruits";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useTotalUnreadCount } from "@/hooks/useActivitySocial";

type ViewMode = 'board' | 'availability' | 'org' | 'digest' | 'goals';

interface QuickViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruits: Recruit[];
  activities: RecruitActivity[];
  onOpenRecruitDetail?: (recruitId: string, initialTab?: string) => void;
  initialTab?: ViewMode;
}

const getDrawerTitle = (viewMode: ViewMode) => {
  switch (viewMode) {
    case 'availability':
      return 'Summer Availability';
    case 'org':
      return 'Organization';
    case 'digest':
      return 'Activity Digest';
    case 'goals':
      return 'Team Goals';
    default:
      return 'All Recruits';
  }
};

export const QuickViewDrawer = ({ 
  open, 
  onOpenChange, 
  recruits,
  activities,
  onOpenRecruitDetail,
  initialTab,
}: QuickViewDrawerProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>(initialTab || 'board');
  const { data: teamAccess } = useTeamAccess();

  // Get recruit IDs for unread count
  const recruitIds = recruits.map(r => r.id);
  const unreadCount = useTotalUnreadCount(recruitIds);

  // Auto-switch to digest tab when opening with many unreads, or respect initialTab
  useEffect(() => {
    if (open) {
      if (initialTab) {
        setViewMode(initialTab);
      } else if (unreadCount >= 5) {
        setViewMode('digest');
      }
    }
  }, [open, initialTab, unreadCount]);

  // Show org/goals tabs for leaders with downline access (AD, MGMT Lead, Team Lead)
  const canViewOrg = teamAccess?.accessLevel === 'area_director' || 
                     teamAccess?.accessLevel === 'mgmt_group_lead' || 
                     teamAccess?.accessLevel === 'team_lead';
  const canViewGoals = canViewOrg || teamAccess?.accessLevel === 'recruiter';
  const showBadge = viewMode === 'board';

  // Handle activity tap from digest - close drawer and open recruit detail
  const handleActivityTap = (recruitId: string, activityId: string) => {
    onOpenChange(false);
    // Small delay to allow drawer close animation
    setTimeout(() => {
      onOpenRecruitDetail?.(recruitId, 'activity');
    }, 150);
  };

  // Handle rep click from goals tab - close drawer and open recruit detail
  const handleGoalsRepClick = (notionPageId: string) => {
    onOpenChange(false);
    setTimeout(() => {
      onOpenRecruitDetail?.(notionPageId, 'details');
    }, 150);
  };

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
              {viewMode === 'digest' && unreadCount > 0 && (
                <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </DrawerTitle>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList className="h-8">
                <TabsTrigger value="board" className="px-2" title="Board">
                  <LayoutGrid className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="digest" className="px-2 relative" title="Activity Digest">
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] rounded-full h-3.5 min-w-[14px] flex items-center justify-center px-0.5">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="availability" className="px-2" title="Availability">
                  <Sun className="h-4 w-4" />
                </TabsTrigger>
                {canViewGoals && (
                  <TabsTrigger value="goals" className="px-2" title="Goals">
                    <Target className="h-4 w-4" />
                  </TabsTrigger>
                )}
                {canViewOrg && (
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
          ) : viewMode === 'digest' ? (
            <ActivityDigestView 
              recruitIds={recruitIds} 
              onActivityTap={handleActivityTap}
            />
          ) : viewMode === 'availability' ? (
            <SummerAvailabilityView />
          ) : viewMode === 'goals' ? (
            <GoalsTabView onRepClick={handleGoalsRepClick} />
          ) : (
            <OrganizationManagementView />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};