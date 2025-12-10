import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Users, Building2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface TeamFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessData: any;
  selectedUserIds: string[];
  onUserIdsChange: (ids: string[]) => void;
  excludeUserIds: string[];
  onExcludeUserIdsChange: (ids: string[]) => void;
  yearFilter?: string[];
  onYearFilterChange?: (years: string[]) => void;
}

export const TeamFilterSheet = ({
  open,
  onOpenChange,
  accessData,
  selectedUserIds,
  onUserIdsChange,
  excludeUserIds,
  onExcludeUserIdsChange,
  yearFilter = [],
  onYearFilterChange,
}: TeamFilterSheetProps) => {
  const [localSelected, setLocalSelected] = useState<string[]>(selectedUserIds);
  const [localExcluded, setLocalExcluded] = useState<string[]>(excludeUserIds);
  const [localYearFilter, setLocalYearFilter] = useState<string[]>(yearFilter);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocalSelected(selectedUserIds);
    setLocalExcluded(excludeUserIds);
    setLocalYearFilter(yearFilter);
  }, [selectedUserIds, excludeUserIds, yearFilter]);

  const handleApply = () => {
    onUserIdsChange(localSelected);
    onExcludeUserIdsChange(localExcluded);
    if (onYearFilterChange) {
      onYearFilterChange(localYearFilter);
    }
    
    // Save to localStorage
    localStorage.setItem('team-reports-filter', JSON.stringify({
      selectedUserIds: localSelected,
      excludeUserIds: localExcluded,
      yearFilter: localYearFilter,
    }));
    
    onOpenChange(false);
  };

  const toggleYearFilter = (year: string) => {
    if (localYearFilter.includes(year)) {
      setLocalYearFilter(localYearFilter.filter(y => y !== year));
    } else {
      setLocalYearFilter([...localYearFilter, year]);
    }
  };

  const stripEmojis = (text: string) => {
    return text.replace(/[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}]/gu, '').trim();
  };

  const toggleGroupExpanded = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  // Get all user IDs for a team
  const getTeamUserIds = (teamId: string): string[] => {
    return accessData?.accessibleReps
      ?.filter((rep: any) => rep.teamId === teamId)
      .map((rep: any) => rep.userId) || [];
  };

  // Get all user IDs for an MGMT group
  const getMgmtGroupUserIds = (mgmtGroup: any): string[] => {
    const teamIds = mgmtGroup.teamIds || [];
    return accessData?.accessibleReps
      ?.filter((rep: any) => teamIds.includes(rep.teamId))
      .map((rep: any) => rep.userId) || [];
  };

  // Check if all users in a group are selected
  const isGroupFullySelected = (userIds: string[]): boolean => {
    return userIds.length > 0 && userIds.every(id => localSelected.includes(id));
  };

  // Check if some users in a group are selected
  const isGroupPartiallySelected = (userIds: string[]): boolean => {
    const selectedCount = userIds.filter(id => localSelected.includes(id)).length;
    return selectedCount > 0 && selectedCount < userIds.length;
  };

  // Toggle entire MGMT group selection
  const toggleMgmtGroup = (mgmtGroup: any) => {
    const userIds = getMgmtGroupUserIds(mgmtGroup);
    if (isGroupFullySelected(userIds)) {
      setLocalSelected(localSelected.filter(id => !userIds.includes(id)));
    } else {
      const newSelected = [...new Set([...localSelected, ...userIds])];
      setLocalSelected(newSelected);
      setLocalExcluded(localExcluded.filter(id => !userIds.includes(id)));
    }
  };

  // Toggle entire team selection
  const toggleTeam = (teamId: string) => {
    const userIds = getTeamUserIds(teamId);
    if (isGroupFullySelected(userIds)) {
      setLocalSelected(localSelected.filter(id => !userIds.includes(id)));
    } else {
      const newSelected = [...new Set([...localSelected, ...userIds])];
      setLocalSelected(newSelected);
      setLocalExcluded(localExcluded.filter(id => !userIds.includes(id)));
    }
  };

  const handleSelectAll = () => {
    setLocalSelected(accessData?.accessibleUserIds || []);
    setLocalExcluded([]);
  };

  const handleDeselectAll = () => {
    setLocalSelected([]);
  };

  const toggleRep = (userId: string) => {
    if (localSelected.includes(userId)) {
      setLocalSelected(localSelected.filter(id => id !== userId));
    } else {
      setLocalSelected([...localSelected, userId]);
      setLocalExcluded(localExcluded.filter(id => id !== userId));
    }
  };

  // Render for Area Directors (MGMT Groups → Teams → Individuals)
  const renderAreaDirectorView = () => {
    return accessData?.mgmtGroups?.map((mgmtGroup: any) => {
      const mgmtUserIds = getMgmtGroupUserIds(mgmtGroup);
      const isExpanded = expandedGroups.has(`mgmt-${mgmtGroup.id}`);
      const fullySelected = isGroupFullySelected(mgmtUserIds);
      const partiallySelected = isGroupPartiallySelected(mgmtUserIds);

      return (
        <Collapsible key={mgmtGroup.id} open={isExpanded} onOpenChange={() => toggleGroupExpanded(`mgmt-${mgmtGroup.id}`)}>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`mgmt-${mgmtGroup.id}`}
              checked={fullySelected}
              onCheckedChange={() => toggleMgmtGroup(mgmtGroup)}
              className={cn(partiallySelected && !fullySelected && "opacity-50")}
            />
            <CollapsibleTrigger className="flex items-center gap-2 flex-1 py-1">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">{mgmtGroup.name}</span>
              <span className="text-xs text-muted-foreground">({mgmtUserIds.length})</span>
              {isExpanded ? <ChevronDown className="w-4 h-4 ml-auto" /> : <ChevronRight className="w-4 h-4 ml-auto" />}
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="ml-6 mt-2 space-y-2">
            {accessData?.teams
              ?.filter((team: any) => mgmtGroup.teamIds?.includes(team.id))
              .map((team: any) => renderTeamSection(team))}
          </CollapsibleContent>
        </Collapsible>
      );
    });
  };

  // Render for MGMT Group Leads (Teams → Individuals)
  const renderMgmtGroupLeadView = () => {
    const reps = accessData?.accessibleReps || [];
    const userMgmtGroups = accessData?.mgmtGroups?.filter((g: any) => 
      reps.some((r: any) => r.notionPageId === g.groupLeadId)
    ) || [];
    const accessibleTeamIds = userMgmtGroups.flatMap((g: any) => g.teamIds || []);
    
    return accessData?.teams
      ?.filter((team: any) => accessibleTeamIds.includes(team.id))
      .map((team: any) => renderTeamSection(team));
  };

  // Render a team section with expandable individuals
  const renderTeamSection = (team: any) => {
    const teamUserIds = getTeamUserIds(team.id);
    const isExpanded = expandedGroups.has(`team-${team.id}`);
    const fullySelected = isGroupFullySelected(teamUserIds);
    const partiallySelected = isGroupPartiallySelected(teamUserIds);
    const teamReps = accessData?.accessibleReps
      ?.filter((rep: any) => rep.teamId === team.id)
      .sort((a: any, b: any) => {
        if (a.isTeamLead && !b.isTeamLead) return -1;
        if (!a.isTeamLead && b.isTeamLead) return 1;
        return stripEmojis(a.name).localeCompare(stripEmojis(b.name));
      }) || [];

    return (
      <Collapsible key={team.id} open={isExpanded} onOpenChange={() => toggleGroupExpanded(`team-${team.id}`)}>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`team-${team.id}`}
            checked={fullySelected}
            onCheckedChange={() => toggleTeam(team.id)}
            className={cn(partiallySelected && !fullySelected && "opacity-50")}
          />
          <CollapsibleTrigger className="flex items-center gap-2 flex-1 py-1">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm">{team.name}</span>
            <span className="text-xs text-muted-foreground">({teamUserIds.length})</span>
            {isExpanded ? <ChevronDown className="w-4 h-4 ml-auto" /> : <ChevronRight className="w-4 h-4 ml-auto" />}
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="ml-6 mt-2 space-y-1">
          {teamReps.map((rep: any) => (
            <div key={rep.userId} className="flex items-center space-x-2">
              <Checkbox
                id={rep.userId}
                checked={localSelected.includes(rep.userId)}
                onCheckedChange={() => toggleRep(rep.userId)}
              />
              <Label htmlFor={rep.userId} className="font-normal cursor-pointer text-sm">
                {stripEmojis(rep.name)}
              </Label>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  // Render for Team Leads (flat list)
  const renderTeamLeadView = () => {
    const reps = accessData?.accessibleReps?.sort((a: any, b: any) => {
      if (a.isTeamLead && !b.isTeamLead) return -1;
      if (!a.isTeamLead && b.isTeamLead) return 1;
      return stripEmojis(a.name).localeCompare(stripEmojis(b.name));
    }) || [];

    return reps.map((rep: any) => (
      <div key={rep.userId} className="flex items-center space-x-2">
        <Checkbox
          id={rep.userId}
          checked={localSelected.includes(rep.userId)}
          onCheckedChange={() => toggleRep(rep.userId)}
        />
        <Label htmlFor={rep.userId} className="font-normal cursor-pointer text-sm">
          {stripEmojis(rep.name)}
        </Label>
      </div>
    ));
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Filter Team Members</DrawerTitle>
          <DrawerDescription>
            Select which team members to include in the report
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4 overflow-y-auto">
          {/* Year Filter */}
          {onYearFilterChange && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Filter by Year</div>
              <div className="flex gap-2 flex-wrap">
                {['rookie', 'sophomore', 'vet'].map((year) => (
                  <Button
                    key={year}
                    variant={localYearFilter.includes(year) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleYearFilter(year)}
                    className="capitalize"
                  >
                    {year === 'vet' ? 'Vet' : year.charAt(0).toUpperCase() + year.slice(1)}
                  </Button>
                ))}
              </div>
              {localYearFilter.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setLocalYearFilter([])}
                  className="text-xs"
                >
                  Clear Year Filter
                </Button>
              )}
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeselectAll}>
              Deselect All
            </Button>
          </div>

          {/* Team Members List with Hierarchy */}
          <div className="space-y-3 max-h-[40dvh] overflow-y-auto pr-2">
            {accessData?.accessLevel === 'area_director' && renderAreaDirectorView()}
            {accessData?.accessLevel === 'mgmt_group_lead' && renderMgmtGroupLeadView()}
            {accessData?.accessLevel === 'team_lead' && renderTeamLeadView()}
          </div>

          {/* Apply Button */}
          <Button onClick={handleApply} className="w-full">
            Apply Filters
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
