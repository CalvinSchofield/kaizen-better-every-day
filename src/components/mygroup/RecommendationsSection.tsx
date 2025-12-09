import { useState } from "react";
import { Sparkles } from "lucide-react";
import { RecruitRecommendation } from "@/hooks/useRecruitingRecommendations";
import { Recruit } from "@/hooks/useGroupRecruits";
import { ContactMethodDrawer } from "./ContactMethodDrawer";
import { ScheduleFollowUpDrawer } from "./ScheduleFollowUpDrawer";
import { SwipeableRecommendationItem } from "./SwipeableRecommendationItem";

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
  // Contact method drawer state (Call/Text/In Person options)
  const [contactRecruit, setContactRecruit] = useState<Recruit | null>(null);
  
  // Schedule drawer state
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedulingRecruit, setSchedulingRecruit] = useState<Recruit | null>(null);

  if (recommendations.length === 0) {
    return null;
  }

  const topRecommendations = recommendations.slice(0, maxItems);

  const handleContact = (recruit: Recruit) => {
    setContactRecruit(recruit);
  };

  const handleSchedule = (recruit: Recruit) => {
    setSchedulingRecruit(recruit);
    setScheduleOpen(true);
  };

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">Recommended Today</h3>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Swipe right to contact, left to schedule
        </p>
        
        <div className="space-y-2">
          {topRecommendations.map((rec) => (
            <SwipeableRecommendationItem
              key={rec.recruit.notionPageId}
              recommendation={rec}
              onRecruitClick={onRecruitClick}
              onContact={handleContact}
              onSchedule={handleSchedule}
            />
          ))}
        </div>
      </div>

      {/* Contact Method Drawer (Call/Text/In Person) */}
      <ContactMethodDrawer
        open={!!contactRecruit}
        onOpenChange={(open) => !open && setContactRecruit(null)}
        recruit={contactRecruit}
      />

      {/* Schedule Follow-up Drawer */}
      <ScheduleFollowUpDrawer
        open={scheduleOpen}
        onOpenChange={(open) => {
          setScheduleOpen(open);
          if (!open) setSchedulingRecruit(null);
        }}
        recruit={schedulingRecruit}
      />
    </>
  );
};
