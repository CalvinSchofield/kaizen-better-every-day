import { useState } from "react";
import { Recruit, RecruitActivity } from "@/hooks/useGroupRecruits";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Calendar, AlertTriangle, ChevronRight, SortAsc, SortDesc } from "lucide-react";
import { RecruitDetailDrawer } from "./RecruitDetailDrawer";
import { differenceInDays, parseISO, format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RecruitListViewProps {
  recruits: Recruit[];
  activities: RecruitActivity[];
}

type SortKey = 'name' | 'stage' | 'lastContact' | 'nextActionDue';

const STAGE_ORDER = [
  '100 List',
  'Reached Out',
  'Evaluating',
  'Signed',
  'Shadow ✅',
  'Sold 💲',
  'Sold (5+) 💰',
];

export const RecruitListView = ({ recruits, activities }: RecruitListViewProps) => {
  const [selectedRecruit, setSelectedRecruit] = useState<Recruit | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('lastContact');
  const [sortDesc, setSortDesc] = useState(true);
  const [filterStale, setFilterStale] = useState(false);

  const isStale = (lastContact: string | null) => {
    if (!lastContact) return true;
    return differenceInDays(new Date(), parseISO(lastContact)) >= 7;
  };

  const getActivitiesForRecruit = (recruitNotionId: string) => {
    return activities.filter(a => a.rep_notion_page_id === recruitNotionId);
  };

  const getStageBadgeColor = (stage: string) => {
    switch (stage) {
      case '100 List': return 'secondary';
      case 'Reached Out': return 'default';
      case 'Evaluating': return 'outline';
      case 'Signed': return 'default';
      case 'Shadow ✅': return 'default';
      case 'Sold 💲': return 'default';
      case 'Sold (5+) 💰': return 'default';
      default: return 'secondary';
    }
  };

  const sortedRecruits = [...recruits]
    .filter(r => !filterStale || isStale(r.lastContact))
    .sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'stage':
          comparison = STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
          break;
        case 'lastContact':
          const aDate = a.lastContact ? parseISO(a.lastContact).getTime() : 0;
          const bDate = b.lastContact ? parseISO(b.lastContact).getTime() : 0;
          comparison = aDate - bDate;
          break;
        case 'nextActionDue':
          const aDue = a.nextActionDue ? parseISO(a.nextActionDue).getTime() : Infinity;
          const bDue = b.nextActionDue ? parseISO(b.nextActionDue).getTime() : Infinity;
          comparison = aDue - bDue;
          break;
      }
      return sortDesc ? -comparison : comparison;
    });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  return (
    <>
      {/* Sort/Filter Controls */}
      <div className="flex items-center gap-2 mb-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              {sortDesc ? <SortDesc className="h-4 w-4" /> : <SortAsc className="h-4 w-4" />}
              Sort by {sortKey}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handleSort('name')}>Name</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort('stage')}>Stage</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort('lastContact')}>Last Contact</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort('nextActionDue')}>Next Action Due</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant={filterStale ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterStale(!filterStale)}
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          Needs Contact
        </Button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {sortedRecruits.map((recruit) => (
          <Card
            key={recruit.notionPageId}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => {
              setSelectedRecruit(recruit);
              setDrawerOpen(true);
            }}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{recruit.name}</p>
                    {isStale(recruit.lastContact) && (
                      <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={getStageBadgeColor(recruit.stage) as any} className="text-xs">
                      {recruit.stage}
                    </Badge>
                    {recruit.lastContact && (
                      <span className="text-xs text-muted-foreground">
                        Last: {format(parseISO(recruit.lastContact), 'MMM d')}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
              {recruit.nextAction && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2 bg-muted/50 rounded px-2 py-1">
                  <Calendar className="h-3 w-3" />
                  <span className="truncate">{recruit.nextAction}</span>
                  {recruit.nextActionDue && (
                    <span className="text-primary ml-auto">
                      {format(parseISO(recruit.nextActionDue), 'MMM d')}
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {sortedRecruits.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No recruits found</p>
          </div>
        )}
      </div>

      <RecruitDetailDrawer
        recruit={selectedRecruit}
        activities={selectedRecruit ? getActivitiesForRecruit(selectedRecruit.notionPageId) : []}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </>
  );
};
