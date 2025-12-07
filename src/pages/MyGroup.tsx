import { useState } from "react";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useGroupRecruits } from "@/hooks/useGroupRecruits";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, LayoutGrid, List, Plus, Filter, CalendarDays } from "lucide-react";
import { RecruitKanbanBoard } from "@/components/mygroup/RecruitKanbanBoard";
import { RecruitListView } from "@/components/mygroup/RecruitListView";
import { RecruitPlannerView } from "@/components/mygroup/RecruitPlannerView";
import { AddRecruitSheet } from "@/components/mygroup/AddRecruitSheet";
import { PendingSuggestionsCard } from "@/components/mygroup/PendingSuggestionsCard";
import { TeamFilterSheet } from "@/components/mygroup/TeamFilterSheet";
import { Skeleton } from "@/components/ui/skeleton";

const MyGroup = () => {
  const { data: teamAccess, isLoading: accessLoading } = useTeamAccess();
  const { data: groupData, isLoading: recruitsLoading, isLeader } = useGroupRecruits();
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'planner'>('board');
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string | null>(null);

  const isLoading = accessLoading || recruitsLoading;

  const allRecruits = groupData?.recruits || [];
  const pendingSuggestions = groupData?.pendingSuggestions || [];
  const activities = groupData?.activities || [];

  // Filter recruits by selected team if applicable
  const filteredRecruits = selectedTeamFilter 
    ? allRecruits.filter(r => r.teamName === selectedTeamFilter || r.recruiterName === selectedTeamFilter)
    : allRecruits;

  // Filter activities to match filtered recruits
  const filteredActivities = selectedTeamFilter
    ? activities.filter(a => filteredRecruits.some(r => r.notionPageId === a.rep_notion_page_id))
    : activities;

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">My Group</h1>
            {pendingSuggestions.length > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
                {pendingSuggestions.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {teamAccess?.accessLevel === 'area_director' || teamAccess?.accessLevel === 'mgmt_group_lead' ? (
              <Button variant="ghost" size="icon" onClick={() => setFilterSheetOpen(true)}>
                <Filter className="h-4 w-4" />
              </Button>
            ) : null}
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
      </div>

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
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg"
        onClick={() => setAddSheetOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Sheets */}
      <AddRecruitSheet open={addSheetOpen} onOpenChange={setAddSheetOpen} />
      <TeamFilterSheet 
        open={filterSheetOpen} 
        onOpenChange={setFilterSheetOpen}
        teams={teamAccess?.teams || []}
        mgmtGroups={teamAccess?.mgmtGroups || []}
        selectedFilter={selectedTeamFilter}
        onFilterChange={setSelectedTeamFilter}
        accessLevel={teamAccess?.accessLevel || 'none'}
      />
    </div>
  );
};

export default MyGroup;
