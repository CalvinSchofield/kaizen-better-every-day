import { useState } from "react";
import { Recruit, RecruitActivity, useUpdateRecruitStage } from "@/hooks/useGroupRecruits";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Calendar, AlertTriangle } from "lucide-react";
import { RecruitDetailDrawer } from "./RecruitDetailDrawer";
import { differenceInDays, parseISO } from "date-fns";
import { toast } from "sonner";

const STAGES = [
  { key: '100 List', label: '100 List', color: 'bg-muted' },
  { key: 'Reached Out', label: 'Reached Out', color: 'bg-blue-500/20' },
  { key: 'Evaluating', label: 'Evaluating', color: 'bg-yellow-500/20' },
  { key: 'Signed', label: 'Signed', color: 'bg-green-500/20' },
  { key: 'Shadow ✅', label: 'Shadow ✅', color: 'bg-emerald-500/20' },
  { key: 'Sold 💲', label: 'Sold 💲', color: 'bg-primary/20' },
  { key: 'Sold (5+) 💰', label: 'Sold (5+) 💰', color: 'bg-amber-500/20' },
];

interface RecruitKanbanBoardProps {
  recruits: Recruit[];
  activities: RecruitActivity[];
}

export const RecruitKanbanBoard = ({ recruits, activities }: RecruitKanbanBoardProps) => {
  const [selectedRecruit, setSelectedRecruit] = useState<Recruit | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const updateStageMutation = useUpdateRecruitStage();

  const getRecruitsByStage = (stage: string) => {
    return recruits.filter(r => r.stage === stage);
  };

  const getActivitiesForRecruit = (recruitNotionId: string) => {
    return activities.filter(a => a.rep_notion_page_id === recruitNotionId);
  };

  const isStale = (lastContact: string | null) => {
    if (!lastContact) return true;
    return differenceInDays(new Date(), parseISO(lastContact)) >= 7;
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

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4">
        {STAGES.map((stage) => {
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
                        {isStale(recruit.lastContact) && (
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
        })}
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
