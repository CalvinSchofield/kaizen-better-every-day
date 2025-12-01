import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";

interface TeamFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessData: any;
  selectedUserIds: string[];
  onUserIdsChange: (ids: string[]) => void;
  excludeUserIds: string[];
  onExcludeUserIdsChange: (ids: string[]) => void;
}

export const TeamFilterSheet = ({
  open,
  onOpenChange,
  accessData,
  selectedUserIds,
  onUserIdsChange,
  excludeUserIds,
  onExcludeUserIdsChange,
}: TeamFilterSheetProps) => {
  const [localSelected, setLocalSelected] = useState<string[]>(selectedUserIds);
  const [localExcluded, setLocalExcluded] = useState<string[]>(excludeUserIds);

  useEffect(() => {
    setLocalSelected(selectedUserIds);
    setLocalExcluded(excludeUserIds);
  }, [selectedUserIds, excludeUserIds]);

  const handleApply = () => {
    onUserIdsChange(localSelected);
    onExcludeUserIdsChange(localExcluded);
    
    // Save to localStorage
    localStorage.setItem('team-reports-filter', JSON.stringify({
      selectedUserIds: localSelected,
      excludeUserIds: localExcluded,
    }));
    
    onOpenChange(false);
  };

  const stripEmojis = (text: string) => {
    return text.replace(/[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}]/gu, '').trim();
  };

  // Group reps by MGMT Group and Team for hierarchical display
  const groupedReps = () => {
    if (!accessData?.accessibleReps) return [];

    const reps = accessData.accessibleReps;
    
    // For Area Director: Group by MGMT Group → Team
    if (accessData.accessLevel === 'area_director') {
      return accessData.mgmtGroups.map((mgmtGroup: any) => ({
        type: 'mgmt-group',
        name: mgmtGroup.name,
        teams: accessData.teams
          .filter((team: any) => mgmtGroup.teamIds.includes(team.id))
          .map((team: any) => ({
            type: 'team',
            name: team.name,
            reps: reps
              .filter((rep: any) => rep.teamId === team.id)
              .sort((a: any, b: any) => {
                // Leader first, then alphabetically
                if (a.isTeamLead && !b.isTeamLead) return -1;
                if (!a.isTeamLead && b.isTeamLead) return 1;
                return stripEmojis(a.name).localeCompare(stripEmojis(b.name));
              })
          }))
      }));
    }
    
    // For MGMT Group Lead: Group by Team
    if (accessData.accessLevel === 'mgmt_group_lead') {
      const userMgmtGroups = accessData.mgmtGroups.filter((g: any) => 
        reps.some((r: any) => r.notionPageId === g.groupLeadId)
      );
      const accessibleTeamIds = userMgmtGroups.flatMap((g: any) => g.teamIds);
      
      return accessData.teams
        .filter((team: any) => accessibleTeamIds.includes(team.id))
        .map((team: any) => ({
          type: 'team',
          name: team.name,
          reps: reps
            .filter((rep: any) => rep.teamId === team.id)
            .sort((a: any, b: any) => {
              if (a.isTeamLead && !b.isTeamLead) return -1;
              if (!a.isTeamLead && b.isTeamLead) return 1;
              return stripEmojis(a.name).localeCompare(stripEmojis(b.name));
            })
        }));
    }
    
    // For Team Lead: Flat list with leader first
    return [{
      type: 'flat',
      reps: reps.sort((a: any, b: any) => {
        if (a.isTeamLead && !b.isTeamLead) return -1;
        if (!a.isTeamLead && b.isTeamLead) return 1;
        return stripEmojis(a.name).localeCompare(stripEmojis(b.name));
      })
    }];
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle>Filter Team Members</SheetTitle>
          <SheetDescription>
            Select which team members to include in the report
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
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
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            <Label className="text-base font-semibold">Team Members</Label>
            {groupedReps().map((group: any, groupIdx: number) => (
              <div key={groupIdx}>
                {group.type === 'mgmt-group' && (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-primary mt-4 first:mt-0">
                      {group.name}
                    </div>
                    {group.teams.map((team: any, teamIdx: number) => (
                      <div key={teamIdx} className="ml-2 space-y-2">
                        <div className={`text-sm font-medium text-muted-foreground pt-3 ${teamIdx > 0 ? 'border-t border-border/50' : ''}`}>
                          {team.name}
                        </div>
                        {team.reps.map((rep: any) => (
                          <div key={rep.userId} className="flex items-center space-x-2 ml-2">
                            <Checkbox
                              id={rep.userId}
                              checked={localSelected.includes(rep.userId)}
                              onCheckedChange={() => toggleRep(rep.userId)}
                            />
                            <Label htmlFor={rep.userId} className="font-normal cursor-pointer flex-1">
                              {stripEmojis(rep.name)}
                            </Label>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                
                {group.type === 'team' && (
                  <div className={`space-y-2 ${groupIdx > 0 ? 'pt-3 border-t border-border/50' : ''}`}>
                    <div className="text-sm font-semibold text-primary">
                      {group.name}
                    </div>
                    {group.reps.map((rep: any) => (
                      <div key={rep.userId} className="flex items-center space-x-2 ml-2">
                        <Checkbox
                          id={rep.userId}
                          checked={localSelected.includes(rep.userId)}
                          onCheckedChange={() => toggleRep(rep.userId)}
                        />
                        <Label htmlFor={rep.userId} className="font-normal cursor-pointer flex-1">
                          {stripEmojis(rep.name)}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
                
                {group.type === 'flat' && group.reps.map((rep: any) => (
                  <div key={rep.userId} className="flex items-center space-x-2">
                    <Checkbox
                      id={rep.userId}
                      checked={localSelected.includes(rep.userId)}
                      onCheckedChange={() => toggleRep(rep.userId)}
                    />
                    <Label htmlFor={rep.userId} className="font-normal cursor-pointer flex-1">
                      {stripEmojis(rep.name)}
                    </Label>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Apply Button */}
          <Button onClick={handleApply} className="w-full">
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
