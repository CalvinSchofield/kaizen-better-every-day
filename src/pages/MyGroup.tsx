import { useState, useMemo } from "react";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useGroupRecruits } from "@/hooks/useGroupRecruits";
import { useBlitzes } from "@/hooks/useBlitzes";
import { useBlitzAttendanceLogger } from "@/hooks/useBlitzAttendanceLogger";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Users, LayoutGrid, List, Plus, Filter, CalendarDays, X } from "lucide-react";
import { RecruitKanbanBoard } from "@/components/mygroup/RecruitKanbanBoard";
import { RecruitListView } from "@/components/mygroup/RecruitListView";
import { RecruitPlannerView } from "@/components/mygroup/RecruitPlannerView";
import { AddRecruitDrawer } from "@/components/mygroup/AddRecruitDrawer";
import { PendingSuggestionsCard } from "@/components/mygroup/PendingSuggestionsCard";
import { TeamFilterSheet } from "@/components/mygroup/TeamFilterSheet";
import { Skeleton } from "@/components/ui/skeleton";
import Layout from "@/components/Layout";

const MyGroup = () => {
  const { data: teamAccess, isLoading: accessLoading } = useTeamAccess();
  const { data: groupData, isLoading: recruitsLoading, isLeader } = useGroupRecruits();
  const { allBlitzes } = useBlitzes();
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'planner'>('board');
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string | null>(null);

  // Auto-log blitz attendance for recently ended blitzes (leaders only)
  useBlitzAttendanceLogger(allBlitzes, isLeader);

  const isLoading = accessLoading || recruitsLoading;

  const allRecruits = groupData?.recruits || [];
  const pendingSuggestions = groupData?.pendingSuggestions || [];
  const activities = groupData?.activities || [];

  // Filter recruits by selected team if applicable
  const filteredRecruits = useMemo(() => {
    if (!selectedTeamFilter) return allRecruits;
    
    // Parse filter format: "team:id" or "mgmt:id"
    if (selectedTeamFilter.startsWith('team:')) {
      const teamId = selectedTeamFilter.replace('team:', '');
      // Filter by teamId directly
      return allRecruits.filter(r => r.teamId === teamId);
    } else if (selectedTeamFilter.startsWith('mgmt:')) {
      const mgmtId = selectedTeamFilter.replace('mgmt:', '');
      // Filter by mgmtGroupId directly
      return allRecruits.filter(r => r.mgmtGroupId === mgmtId);
    }
    return allRecruits;
  }, [selectedTeamFilter, allRecruits]);

  // Filter activities to match filtered recruits
  const filteredActivities = useMemo(() => {
    if (!selectedTeamFilter) return activities;
    return activities.filter(a => filteredRecruits.some(r => r.notionPageId === a.rep_notion_page_id));
  }, [selectedTeamFilter, activities, filteredRecruits]);

  // Get active filter name for display
  const activeFilterName = useMemo(() => {
    if (!selectedTeamFilter) return null;
    if (selectedTeamFilter.startsWith('team:')) {
      const teamId = selectedTeamFilter.replace('team:', '');
      return teamAccess?.teams?.find(t => t.id === teamId)?.name || null;
    } else if (selectedTeamFilter.startsWith('mgmt:')) {
      const mgmtId = selectedTeamFilter.replace('mgmt:', '');
      return teamAccess?.mgmtGroups?.find(g => g.id === mgmtId)?.name || null;
    }
    return null;
  }, [selectedTeamFilter, teamAccess]);

  // Calculate recruit counts per team for the filter sheet
  const teamRecruitCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    
    // Count by teamId
    teamAccess?.teams?.forEach(team => {
      counts[`team:${team.id}`] = allRecruits.filter(r => r.teamId === team.id).length;
    });
    
    // Count by mgmtGroupId
    teamAccess?.mgmtGroups?.forEach(group => {
      counts[`mgmt:${group.id}`] = allRecruits.filter(r => r.mgmtGroupId === group.id).length;
    });
    
    return counts;
  }, [allRecruits, teamAccess]);

  if (isLoading) {
    return (
      <Layout>
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  // Pass header controls to Layout via children pattern - we'll render content directly
  const headerControls = (
    <div className="flex items-center justify-between w-full">
      <h1 className="text-lg font-semibold text-foreground">My Group</h1>
      <div className="flex items-center gap-2">
        {activeFilterName && (
          <Badge 
            variant="secondary" 
            className="flex items-center gap-1 cursor-pointer hover:bg-secondary/80"
            onClick={() => setSelectedTeamFilter(null)}
          >
            {activeFilterName}
            <X className="h-3 w-3" />
          </Badge>
        )}
        {(teamAccess?.accessLevel === 'area_director' || teamAccess?.accessLevel === 'mgmt_group_lead') && (
          <Button 
            variant={selectedTeamFilter ? 'default' : 'ghost'} 
            size="icon" 
            onClick={() => setFilterSheetOpen(true)}
          >
            <Filter className="h-4 w-4" />
          </Button>
        )}
        {isLeader && (
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'board' | 'list' | 'planner')}>
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
            </TabsList>
          </Tabs>
        )}
      </div>
    </div>
  );

  return (
    <Layout headerRightContent={headerControls}>
      <div className="p-4 space-y-4">
        {/* Pending Suggestions for Leaders */}
        {isLeader && pendingSuggestions.length > 0 && (
          <PendingSuggestionsCard suggestions={pendingSuggestions} />
        )}

        {/* Main Content */}
        {isLeader ? (
          viewMode === 'board' ? (
            <RecruitKanbanBoard recruits={filteredRecruits} activities={filteredActivities} />
          ) : viewMode === 'list' ? (
            <RecruitListView recruits={filteredRecruits} activities={filteredActivities} />
          ) : (
            <RecruitPlannerView recruits={filteredRecruits} activities={filteredActivities} />
          )
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Know someone who'd be great?</p>
            <p className="text-sm mb-4">Suggest a recruit to your team leader</p>
            <Button onClick={() => setAddSheetOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Someone
            </Button>
          </div>
        )}
      </div>

      {/* Floating Add Button */}
      <Button
        className="fixed right-4 h-14 w-14 rounded-full shadow-lg z-40"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom) + 1.5rem)' }}
        onClick={() => setAddSheetOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Sheets */}
      <AddRecruitDrawer open={addSheetOpen} onOpenChange={setAddSheetOpen} />
      <TeamFilterSheet 
        open={filterSheetOpen} 
        onOpenChange={setFilterSheetOpen}
        teams={teamAccess?.teams || []}
        mgmtGroups={teamAccess?.mgmtGroups || []}
        selectedFilter={selectedTeamFilter}
        onFilterChange={setSelectedTeamFilter}
        accessLevel={teamAccess?.accessLevel || 'none'}
        recruitCounts={teamRecruitCounts}
        totalRecruits={allRecruits.length}
      />
    </Layout>
  );
};

export default MyGroup;
