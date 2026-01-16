import { Check, Filter, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface Team {
  id: string;
  name: string;
}

interface MgmtGroup {
  id: string;
  name: string;
  teamIds: string[];
}

export type TeamFilter = 
  | 'all' 
  | { type: 'mgmt_group'; id: string; name: string }
  | { type: 'team'; id: string; name: string };

interface ReportsTeamFilterProps {
  teams: Team[];
  mgmtGroups: MgmtGroup[];
  accessLevel: 'area_director' | 'mgmt_group_lead' | 'team_lead' | 'recruiter' | 'none';
  selectedFilter: TeamFilter;
  onFilterChange: (filter: TeamFilter) => void;
  repCount?: number;
}

export const ReportsTeamFilter = ({
  teams,
  mgmtGroups,
  accessLevel,
  selectedFilter,
  onFilterChange,
  repCount,
}: ReportsTeamFilterProps) => {
  // Only show for area directors and mgmt group leads
  if (accessLevel !== 'area_director' && accessLevel !== 'mgmt_group_lead') {
    return null;
  }

  const getFilterLabel = () => {
    if (selectedFilter === 'all') return null;
    return selectedFilter.name;
  };

  const filterLabel = getFilterLabel();
  const isFiltered = selectedFilter !== 'all';

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button
          variant={isFiltered ? "secondary" : "ghost"}
          size="sm"
          className="gap-1.5"
        >
          <Filter className="h-4 w-4" />
          {filterLabel ? (
            <span className="max-w-[100px] truncate">{filterLabel}</span>
          ) : (
            <span className="hidden sm:inline">Filter</span>
          )}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="px-4 pb-8">
        <DrawerHeader className="px-0">
          <DrawerTitle>Filter by Team</DrawerTitle>
        </DrawerHeader>

        <div className="space-y-4">
          {/* All Teams Option */}
          <button
            onClick={() => onFilterChange('all')}
            className={cn(
              "w-full flex items-center justify-between p-3 rounded-lg border transition-colors",
              selectedFilter === 'all'
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/50"
            )}
          >
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">All Teams</span>
            </div>
            <div className="flex items-center gap-2">
              {repCount !== undefined && (
                <Badge variant="secondary" className="text-xs">
                  {repCount} reps
                </Badge>
              )}
              {selectedFilter === 'all' && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </div>
          </button>

          {/* MGMT Groups - only for Area Directors */}
          {accessLevel === 'area_director' && mgmtGroups.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                Management Groups
              </p>
              {mgmtGroups.map((group) => {
                const isSelected = 
                  selectedFilter !== 'all' && 
                  selectedFilter.type === 'mgmt_group' && 
                  selectedFilter.id === group.id;
                
                return (
                  <button
                    key={group.id}
                    onClick={() => onFilterChange({ 
                      type: 'mgmt_group', 
                      id: group.id, 
                      name: group.name 
                    })}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-lg border transition-colors",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <span className="font-medium">{group.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {group.teamIds.length} teams
                      </Badge>
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Teams */}
          {teams.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                Teams
              </p>
              {teams.map((team) => {
                const isSelected = 
                  selectedFilter !== 'all' && 
                  selectedFilter.type === 'team' && 
                  selectedFilter.id === team.id;
                
                return (
                  <button
                    key={team.id}
                    onClick={() => onFilterChange({ 
                      type: 'team', 
                      id: team.id, 
                      name: team.name 
                    })}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-lg border transition-colors",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <span className="font-medium">{team.name}</span>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
