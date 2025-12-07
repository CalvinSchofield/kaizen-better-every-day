import { useState } from "react";
import { Recruit, RecruitActivity, useUpdateRecruitStage } from "@/hooks/useGroupRecruits";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Calendar, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { RecruitDetailDrawer } from "./RecruitDetailDrawer";
import { differenceInDays, parseISO, isAfter, isBefore, startOfToday } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Primary stages always shown
const PRIMARY_STAGES = [
  { key: '100 List', label: '100 List', color: 'bg-muted' },
  { key: 'Reached Out', label: 'Reached Out', color: 'bg-blue-500/20' },
  { key: 'Evaluating', label: 'Evaluating', color: 'bg-yellow-500/20' },
  { key: 'Signed', label: 'Signed', color: 'bg-green-500/20' },
  { key: 'Shadow ✅', label: 'Shadow ✅', color: 'bg-emerald-500/20' },
  { key: 'Sold 💲', label: 'Sold 💲', color: 'bg-primary/20' },
  { key: 'Sold (5+) 💰', label: 'Sold (5+) 💰', color: 'bg-amber-500/20' },
];

// Secondary stages - hidden by default
const SECONDARY_STAGES = [
  { key: 'Potential Follow Up', label: 'Follow Up', color: 'bg-purple-500/20' },
  { key: 'Not Interested', label: 'Not Interested', color: 'bg-destructive/20' },
  { key: 'Signed but Not Interested', label: 'Signed (Left)', color: 'bg-destructive/20' },
];

interface RecruitKanbanBoardProps {
  recruits: Recruit[];
  activities: RecruitActivity[];
}

export const RecruitKanbanBoard = ({ recruits, activities }: RecruitKanbanBoardProps) => {
  const [selectedRecruit, setSelectedRecruit] = useState<Recruit | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showSecondary, setShowSecondary] = useState(false);
  const updateStageMutation = useUpdateRecruitStage();

  // Filter recruits for display
  // - For "Potential Follow Up", only show if follow-up date is today or past
  // - Always exclude "Not Interested" and "Signed but Not Interested" from primary view
  const getRecruitsByStage = (stage: string) => {
    return recruits.filter(r => {
      if (r.stage !== stage) return false;
      
      // For Potential Follow Up, only show if due today or overdue
      if (stage === 'Potential Follow Up') {
        if (!r.nextActionDue) return false;
        const dueDate = parseISO(r.nextActionDue);
        const today = startOfToday();
        return isBefore(dueDate, today) || dueDate.getTime() === today.getTime();
      }
      
      return true;
    });
  };

  const getActivitiesForRecruit = (recruitNotionId: string) => {
    return activities.filter(a => a.rep_notion_page_id === recruitNotionId);
  };

  // Show stale warning based on stage-specific thresholds
  const isStale = (recruit: Recruit) => {
    const stage = recruit.stage?.toLowerCase() || '';
    
    // Don't show warning for completed/closed stages
    if (stage.includes('not interested')) return false;
    
    // For Sold reps, 14 day threshold (they need less frequent check-ins)
    if (stage.includes('sold') || stage.includes('5+')) {
      if (!recruit.lastContact) return false;
      return differenceInDays(new Date(), parseISO(recruit.lastContact)) >= 14;
    }
    
    // For all other stages (100 List, Reached Out, Evaluating, Signed, Shadow), 7 days
    if (!recruit.lastContact) return true; // Never contacted = needs attention
    return differenceInDays(new Date(), parseISO(recruit.lastContact)) >= 7;
  };

  const handleDragStart = (e: React.DragEvent, recruit: Recruit) => {
    e.dataTransfer.setData('recruitId', recruit.notionPageId);
    e.dataTransfer.setData('currentStage', recruit.stage);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStage: string) => {
    e.preventDefault();
    const recruitId = e.dataTransfer.getData('recruitId');
    const currentStage = e.dataTransfer.getData('currentStage');

    if (currentStage !== newStage) {
      try {
        await updateStageMutation.mutateAsync({
          recruitNotionId: recruitId,
          newStage,
        });
        toast.success(`Moved to ${newStage}`);
      } catch (error) {
        toast.error('Failed to update stage');
      }
    }
  };

  const handleRecruitClick = (recruit: Recruit) => {
    setSelectedRecruit(recruit);
    setDrawerOpen(true);
  };

  // Count recruits in secondary stages
  const secondaryCount = SECONDARY_STAGES.reduce((acc, stage) => {
    return acc + getRecruitsByStage(stage.key).length;
  }, 0);

  // When drawer closes, update selected recruit from latest data
  const handleDrawerOpenChange = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      // Update selected recruit with latest data if it exists
      if (selectedRecruit) {
        const updatedRecruit = recruits.find(r => r.notionPageId === selectedRecruit.notionPageId);
        if (updatedRecruit) {
          setSelectedRecruit(updatedRecruit);
        }
      }
    }
  };

  const renderStageColumn = (stage: { key: string; label: string; color: string }) => {
    const stageRecruits = getRecruitsByStage(stage.key);
    return (
      <div
        key={stage.key}
        className="flex-shrink-0 w-64"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, stage.key)}
      >
        <div className={`rounded-lg ${stage.color} p-2 mb-2`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{stage.label}</span>
            <Badge variant="secondary" className="text-xs">
              {stageRecruits.length}
            </Badge>
          </div>
        </div>
        <div className="space-y-2 min-h-[200px]">
          {stageRecruits.map((recruit) => (
            <Card
              key={recruit.notionPageId}
              className="cursor-pointer hover:shadow-md transition-shadow"
              draggable
              onDragStart={(e) => handleDragStart(e, recruit)}
              onClick={() => handleRecruitClick(recruit)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{recruit.name}</p>
                    {recruit.phone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Phone className="h-3 w-3" />
                        <span>{recruit.phone}</span>
                      </div>
                    )}
                  </div>
                  {isStale(recruit) && (
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  )}
                </div>
                {recruit.nextAction && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2 bg-muted/50 rounded px-2 py-1">
                    <Calendar className="h-3 w-3" />
                    <span className="truncate">{recruit.nextAction}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4">
        {PRIMARY_STAGES.map(renderStageColumn)}
      </div>

      {/* Toggle for secondary stages */}
      {secondaryCount > 0 && (
        <div className="mt-2 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSecondary(!showSecondary)}
            className="text-muted-foreground"
          >
            {showSecondary ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Hide Other Stages ({secondaryCount})
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Show Other Stages ({secondaryCount})
              </>
            )}
          </Button>
        </div>
      )}

      {showSecondary && (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4">
          {SECONDARY_STAGES.map(renderStageColumn)}
        </div>
      )}

      <RecruitDetailDrawer
        recruit={selectedRecruit}
        activities={selectedRecruit ? getActivitiesForRecruit(selectedRecruit.notionPageId) : []}
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
      />
    </>
  );
};
