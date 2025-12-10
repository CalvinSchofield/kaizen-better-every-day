import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle 
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Users } from "lucide-react";

interface Team {
  id: string;
  name: string;
  groupLeadId: string;
}

interface MgmtGroup {
  id: string;
  name: string;
  teamIds: string[];
  groupLeadId: string;
}

interface TeamFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: Team[];
  mgmtGroups: MgmtGroup[];
  selectedFilter: string | null;
  onFilterChange: (filter: string | null) => void;
  accessLevel: 'area_director' | 'mgmt_group_lead' | 'team_lead' | 'none';
  recruitCounts?: Record<string, number>;
  totalRecruits?: number;
}

export const TeamFilterSheet = ({
  open,
  onOpenChange,
  teams,
  mgmtGroups,
  selectedFilter,
  onFilterChange,
  accessLevel,
  recruitCounts = {},
  totalRecruits = 0,
}: TeamFilterSheetProps) => {
  const handleFilterSelect = (filter: string | null) => {
    onFilterChange(filter);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[70dvh]">
        <DrawerHeader>
          <DrawerTitle>Filter by Team</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4 overflow-y-auto">
          {/* All Teams Option */}
          <Button
            variant={selectedFilter === null ? 'default' : 'outline'}
            className="w-full justify-start"
            onClick={() => handleFilterSelect(null)}
          >
            <Users className="h-4 w-4 mr-2" />
            All Teams
            <Badge variant="secondary" className="ml-auto mr-2">
              {totalRecruits}
            </Badge>
            {selectedFilter === null && (
              <Check className="h-4 w-4" />
            )}
          </Button>

          {/* MGMT Groups (for Area Directors) */}
          {accessLevel === 'area_director' && mgmtGroups.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Management Groups
              </p>
              <div className="space-y-2">
                  {mgmtGroups.map((group) => (
                    <Button
                      key={group.id}
                      variant={selectedFilter === `mgmt:${group.id}` ? 'default' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => handleFilterSelect(`mgmt:${group.id}`)}
                    >
                      {group.name}
                      <Badge variant="secondary" className="ml-auto mr-2">
                        {recruitCounts[`mgmt:${group.id}`] || 0}
                      </Badge>
                      {selectedFilter === `mgmt:${group.id}` && (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                  ))}
              </div>
            </div>
          )}

          {/* Individual Teams */}
          {teams.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Teams
              </p>
              <div className="space-y-2">
                  {teams.map((team) => (
                    <Button
                      key={team.id}
                      variant={selectedFilter === `team:${team.id}` ? 'default' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => handleFilterSelect(`team:${team.id}`)}
                    >
                      {team.name}
                      <Badge variant="secondary" className="ml-auto mr-2">
                        {recruitCounts[`team:${team.id}`] || 0}
                      </Badge>
                      {selectedFilter === `team:${team.id}` && (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
