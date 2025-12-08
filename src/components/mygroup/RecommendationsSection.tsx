import { useState } from "react";
import { Phone, MessageSquare, Calendar, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecruitRecommendation } from "@/hooks/useRecruitingRecommendations";
import { cn } from "@/lib/utils";
import { Recruit } from "@/hooks/useGroupRecruits";
import { PostContactDrawer } from "./PostContactDrawer";
import { ScheduleFollowUpDrawer } from "./ScheduleFollowUpDrawer";
import { SwipeableRecommendationItem } from "./SwipeableRecommendationItem";

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
  // Post-contact drawer state
  const [postContactOpen, setPostContactOpen] = useState(false);
  const [contactingRecruit, setContactingRecruit] = useState<Recruit | null>(null);
  const [contactMethod, setContactMethod] = useState<'call' | 'text' | 'in_person'>('call');
  
  // Schedule drawer state
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedulingRecruit, setSchedulingRecruit] = useState<Recruit | null>(null);

  if (recommendations.length === 0) {
    return null;
  }

  const topRecommendations = recommendations.slice(0, maxItems);

  const handleContact = (recruit: Recruit) => {
    setContactingRecruit(recruit);
    setContactMethod('call');
    setPostContactOpen(true);
  };

  const handleSchedule = (recruit: Recruit) => {
    setSchedulingRecruit(recruit);
    setScheduleOpen(true);
  };

  const handlePostContactComplete = () => {
    setContactingRecruit(null);
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

      {/* Post-Contact Drawer */}
      <PostContactDrawer
        open={postContactOpen}
        onOpenChange={setPostContactOpen}
        recruit={contactingRecruit}
        contactMethod={contactMethod}
        onComplete={handlePostContactComplete}
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
