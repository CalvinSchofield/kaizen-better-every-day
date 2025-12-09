import { UserRoundSearch, Calendar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AttentionRecruit } from "@/hooks/useNeedsAttention";
import { Recruit } from "@/hooks/useGroupRecruits";
import { cn } from "@/lib/utils";

interface TodaysFocusHeroProps {
  topPriority: AttentionRecruit | null;
  totalNeedsAttention: number;
  onRecruitClick: (recruit: Recruit) => void;
  onViewAll: () => void;
  onContactClick?: (recruit: Recruit) => void;
  onScheduleClick?: (recruit: Recruit) => void;
  animatingOut?: boolean;
}

// Strip emojis from name
const stripEmojis = (text: string | null): string | null => {
  if (!text) return null;
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
};

export const TodaysFocusHero = ({ 
  topPriority, 
  totalNeedsAttention,
  onRecruitClick,
  onViewAll,
  onContactClick,
  onScheduleClick,
  animatingOut = false
}: TodaysFocusHeroProps) => {

  const handleContact = () => {
    if (!topPriority) return;
    onContactClick?.(topPriority.recruit);
  };

  const handleSchedule = () => {
    if (!topPriority) return;
    onScheduleClick?.(topPriority.recruit);
  };

  if (!topPriority) {
    return (
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-2xl p-6 border border-primary/20">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <span className="text-sm font-medium text-primary">Today's Focus</span>
        </div>
        <h2 className="text-xl font-semibold mb-2">All Caught Up!</h2>
        <p className="text-sm text-muted-foreground">
          No urgent recruiting tasks right now. Great job staying on top of things!
        </p>
      </div>
    );
  }

  const urgencyColors = {
    high: 'border-red-500/30 bg-red-500/5',
    medium: 'border-amber-500/30 bg-amber-500/5',
    low: 'border-green-500/30 bg-green-500/5',
  };

  const firstName = stripEmojis(topPriority.recruit.name)?.split(' ')[0];

  return (
    <div 
      className={cn(
        "rounded-2xl p-5 border-2 transition-all duration-300",
        urgencyColors[topPriority.urgency],
        animatingOut && "animate-fade-out opacity-0 scale-95"
      )}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-full bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <span className="text-sm font-medium text-primary">Today's Focus</span>
      </div>

      <div 
        className="cursor-pointer"
        onClick={() => onRecruitClick(topPriority.recruit)}
      >
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-xl font-semibold">
            {stripEmojis(topPriority.recruit.name)}
          </h2>
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs",
              topPriority.urgency === 'high' && "border-red-500/50 text-red-600 bg-red-500/10",
              topPriority.urgency === 'medium' && "border-amber-500/50 text-amber-600 bg-amber-500/10",
              topPriority.urgency === 'low' && "border-green-500/50 text-green-600 bg-green-500/10"
            )}
          >
            {topPriority.recruit.stage}
          </Badge>
        </div>
        
        <p className="text-sm text-muted-foreground mb-4">
          {topPriority.reason}
        </p>
      </div>

      <div className="flex gap-2">
        <Button 
          className="flex-1 gap-2"
          size="lg"
          onClick={handleContact}
        >
          <UserRoundSearch className="h-4 w-4" />
          Contact
        </Button>
        <Button 
          variant="outline"
          size="lg"
          onClick={handleSchedule}
          className="gap-2"
        >
          <Calendar className="h-4 w-4" />
          Schedule
        </Button>
      </div>
    </div>
  );
};
