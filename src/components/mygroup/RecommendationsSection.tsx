import { Phone, MessageSquare, Calendar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecruitRecommendation } from "@/hooks/useRecruitingRecommendations";
import { useLogRecruitActivity } from "@/hooks/useGroupRecruits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// Helper to strip emojis from names
const stripEmojis = (text: string | null): string | null => {
  if (!text) return null;
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
};

const BADGE_STYLES: Record<RecruitRecommendation['reasonBadge'], string> = {
  'signed': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'hot-lead': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  'pipeline': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'stale': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'overdue': 'bg-red-500/10 text-red-600 border-red-500/20',
};

interface RecommendationsSectionProps {
  recommendations: RecruitRecommendation[];
  onRecruitClick: (recruit: RecruitRecommendation['recruit']) => void;
  maxItems?: number;
}

export const RecommendationsSection = ({ 
  recommendations, 
  onRecruitClick,
  maxItems = 5 
}: RecommendationsSectionProps) => {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedRec, setSelectedRec] = useState<RecruitRecommendation | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledAction, setScheduledAction] = useState('Follow up');
  
  const logActivityMutation = useLogRecruitActivity();

  if (recommendations.length === 0) {
    return null;
  }

  const topRecommendations = recommendations.slice(0, maxItems);

  const handleCall = async (rec: RecruitRecommendation, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await logActivityMutation.mutateAsync({
        recruitNotionId: rec.recruit.notionPageId,
        activityType: 'phone_call',
        notes: 'Call attempt',
        updateLastContact: true,
      });
      toast.success('Call logged');
    } catch (error) {
      console.error('Failed to log call:', error);
    }
    window.location.href = `tel:${rec.recruit.phone}`;
  };

  const handleSchedule = (rec: RecruitRecommendation, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRec(rec);
    setScheduledDate(new Date().toISOString().split('T')[0]);
    setScheduledAction('Follow up');
    setScheduleOpen(true);
  };

  const handleSaveSchedule = async () => {
    if (!selectedRec || !scheduledDate) return;
    
    try {
      await logActivityMutation.mutateAsync({
        recruitNotionId: selectedRec.recruit.notionPageId,
        activityType: 'next_step',
        nextAction: scheduledAction,
        nextActionDue: scheduledDate,
      });
      toast.success('Scheduled!');
      setScheduleOpen(false);
      setSelectedRec(null);
    } catch (error) {
      toast.error('Failed to schedule');
    }
  };

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">Recommended Today</h3>
        </div>
        
        <div className="space-y-2">
          {topRecommendations.map((rec) => (
            <div
              key={rec.recruit.notionPageId}
              className="bg-card rounded-lg p-3 border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onRecruitClick(rec.recruit)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {stripEmojis(rec.recruit.name)}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs px-1.5 py-0", BADGE_STYLES[rec.reasonBadge])}
                    >
                      {rec.reason}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {rec.recruit.stage}
                    </Badge>
                    {rec.daysSinceContact !== null && (
                      <span className="text-xs text-muted-foreground">
                        {rec.daysSinceContact}d ago
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => handleCall(rec, e)}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => handleSchedule(rec, e)}
                  >
                    <Calendar className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Schedule Sheet */}
      <Sheet open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <SheetContent side="bottom" className="h-auto">
          <SheetHeader>
            <SheetTitle>
              Schedule Follow-up with {selectedRec && stripEmojis(selectedRec.recruit.name)}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">What to do</label>
              <Input
                value={scheduledAction}
                onChange={(e) => setScheduledAction(e.target.value)}
                placeholder="e.g., Follow up about training"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">When</label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button 
              className="w-full" 
              onClick={handleSaveSchedule}
              disabled={logActivityMutation.isPending}
            >
              {logActivityMutation.isPending ? 'Saving...' : 'Schedule'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
