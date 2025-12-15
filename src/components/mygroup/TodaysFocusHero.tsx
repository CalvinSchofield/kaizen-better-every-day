import { UserRoundSearch, Calendar, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecruitRecommendation } from "@/hooks/useRecruitingRecommendations";
import { Recruit } from "@/hooks/useGroupRecruits";
import { cn } from "@/lib/utils";
import { SkipMenu } from "./SkipMenu";

interface TodaysFocusHeroProps {
  topRecommendation: RecruitRecommendation | null;
  totalNeedsAttention: number;
  onRecruitClick: (recruit: Recruit) => void;
  onViewAll: () => void;
  onContactClick?: (recruit: Recruit) => void;
  onScheduleClick?: (recruit: Recruit) => void;
  onSkipForNow?: (recruit: Recruit) => void;
  onSkipToday?: (recruit: Recruit) => void;
  animatingOut?: boolean;
}

// Strip emojis from name
const stripEmojis = (text: string | null): string | null => {
  if (!text) return null;
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
};

const BADGE_STYLES: Record<RecruitRecommendation['reasonBadge'], string> = {
  'blitz-critical': 'border-red-500/50 text-red-600 bg-red-500/10',
  'blitz-prep': 'border-purple-500/50 text-purple-600 bg-purple-500/10',
  'signed': 'border-emerald-500/50 text-emerald-600 bg-emerald-500/10',
  'hot-lead': 'border-orange-500/50 text-orange-600 bg-orange-500/10',
  'pipeline': 'border-blue-500/50 text-blue-600 bg-blue-500/10',
  'stale': 'border-amber-500/50 text-amber-600 bg-amber-500/10',
  'overdue': 'border-red-500/50 text-red-600 bg-red-500/10',
};

const CONTAINER_STYLES: Record<RecruitRecommendation['reasonBadge'], string> = {
  'blitz-critical': 'border-red-500/30 bg-red-500/5',
  'blitz-prep': 'border-purple-500/30 bg-purple-500/5',
  'signed': 'border-emerald-500/30 bg-emerald-500/5',
  'hot-lead': 'border-orange-500/30 bg-orange-500/5',
  'pipeline': 'border-blue-500/30 bg-blue-500/5',
  'stale': 'border-amber-500/30 bg-amber-500/5',
  'overdue': 'border-red-500/30 bg-red-500/5',
};

export const TodaysFocusHero = ({ 
  topRecommendation, 
  totalNeedsAttention,
  onRecruitClick,
  onViewAll,
  onContactClick,
  onScheduleClick,
  onSkipForNow,
  onSkipToday,
  animatingOut = false
}: TodaysFocusHeroProps) => {

  const handleSkipForNow = () => {
    if (!topRecommendation) return;
    onSkipForNow?.(topRecommendation.recruit);
  };

  const handleSkipToday = () => {
    if (!topRecommendation) return;
    onSkipToday?.(topRecommendation.recruit);
  };

  const handleContact = () => {
    if (!topRecommendation) return;
    onContactClick?.(topRecommendation.recruit);
  };

  const handleSchedule = () => {
    if (!topRecommendation) return;
    onScheduleClick?.(topRecommendation.recruit);
  };

  if (!topRecommendation) {
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

  const isCritical = topRecommendation.reasonBadge === 'blitz-critical';

  return (
    <div 
      className={cn(
        "rounded-2xl p-5 border-2 transition-all duration-300",
        CONTAINER_STYLES[topRecommendation.reasonBadge],
        animatingOut && "animate-fade-out opacity-0 scale-95"
      )}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className={cn(
          "p-2 rounded-full",
          isCritical ? "bg-red-500/10" : "bg-primary/10"
        )}>
          {isCritical ? (
            <AlertTriangle className="h-5 w-5 text-red-500" />
          ) : (
            <Sparkles className="h-5 w-5 text-primary" />
          )}
        </div>
        <span className={cn(
          "text-sm font-medium",
          isCritical ? "text-red-600" : "text-primary"
        )}>
          {isCritical ? "Urgent Action Needed" : "Today's Focus"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {topRecommendation.daysUntilBlitz !== undefined && topRecommendation.daysUntilBlitz >= 0 && (
            <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-600 bg-purple-500/10">
              {topRecommendation.daysUntilBlitz === 0 ? 'Blitz today' : 
               topRecommendation.daysUntilBlitz === 1 ? 'Blitz tomorrow' : 
               `Blitz in ${topRecommendation.daysUntilBlitz}d`}
            </Badge>
          )}
          <SkipMenu 
            onSkipForNow={handleSkipForNow}
            onSkipToday={handleSkipToday}
            variant="ghost"
            size="sm"
            className="h-7 w-7"
          />
        </div>
      </div>

      <div 
        className="cursor-pointer"
        onClick={() => onRecruitClick(topRecommendation.recruit)}
      >
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-xl font-semibold">
            {stripEmojis(topRecommendation.recruit.name)}
          </h2>
          <Badge 
            variant="outline" 
            className={cn("text-xs", BADGE_STYLES[topRecommendation.reasonBadge])}
          >
            {topRecommendation.recruit.stage}
          </Badge>
        </div>
        
        <p className="text-sm text-muted-foreground mb-3">
          {topRecommendation.reason}
        </p>

        {/* Show scheduled follow-up indicator if due today */}
        {topRecommendation.scheduledFollowUp?.isDueToday && (
          <div className="mb-3">
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
              <Calendar className="h-3 w-3 mr-1" />
              Follow-up scheduled for today
            </Badge>
          </div>
        )}
        {topRecommendation.missingItems && topRecommendation.missingItems.length > 0 && (
          <div className="mb-4">
            <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5">
              Next: {topRecommendation.missingItems[0]}
            </Badge>
          </div>
        )}
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
