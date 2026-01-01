import { UserRoundSearch, Calendar, Sparkles, AlertTriangle, Trophy, Flame, Bell, Clock, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RecruitRecommendation } from "@/hooks/useRecruitingRecommendations";
import { SummerRecommendation } from "@/hooks/useSummerRecommendations";
import { Recruit, RecruitActivity } from "@/hooks/useGroupRecruits";
import { AttentionRecruit } from "@/hooks/useNeedsAttention";
import { cn } from "@/lib/utils";
import { SkipMenu } from "./SkipMenu";
import { format, parseISO, differenceInDays } from "date-fns";

// Combined recommendation type for both preseason and summer
export type HeroRecommendation = 
  | { type: 'preseason'; data: RecruitRecommendation }
  | { type: 'summer'; data: SummerRecommendation };

// Overdue scheduled item type
export interface OverdueScheduledItem {
  recruit: Recruit;
  activity: RecruitActivity;
  daysOverdue: number;
}

// Today's scheduled item type
export interface TodayScheduledItem {
  recruit: Recruit;
  activity: RecruitActivity;
}

interface TodaysFocusHeroProps {
  topRecommendation: RecruitRecommendation | null;
  summerRecommendation?: SummerRecommendation | null;
  overdueScheduledFallback?: OverdueScheduledItem | null;
  todayScheduledItem?: TodayScheduledItem | null;
  needsAttentionFallback?: AttentionRecruit | null;
  totalNeedsAttention: number;
  onRecruitClick: (recruit: Recruit) => void;
  onSummerRepClick?: (notionPageId: string) => void;
  onViewAll: () => void;
  onContactClick?: (recruit: Recruit, activity?: RecruitActivity) => void;
  onScheduleClick?: (recruit: Recruit) => void;
  onRescheduleActivityClick?: (recruit: Recruit, activity: RecruitActivity) => void;
  onSkipForNow?: (recruit: Recruit) => void;
  onSkipToday?: (recruit: Recruit) => void;
  onLogOneOnOneClick?: (repUserId: string, repName: string) => void;
  animatingOut?: boolean;
  isLoading?: boolean;
}

// Strip emojis from name
const stripEmojis = (text: string | null): string | null => {
  if (!text) return null;
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
};

const BADGE_STYLES: Record<string, string> = {
  'blitz-critical': 'border-red-500/50 text-red-600 bg-red-500/10',
  'blitz-prep': 'border-purple-500/50 text-purple-600 bg-purple-500/10',
  'signed': 'border-emerald-500/50 text-emerald-600 bg-emerald-500/10',
  'hot-lead': 'border-orange-500/50 text-orange-600 bg-orange-500/10',
  'pipeline': 'border-blue-500/50 text-blue-600 bg-blue-500/10',
  'stale': 'border-amber-500/50 text-amber-600 bg-amber-500/10',
  'overdue': 'border-red-500/50 text-red-600 bg-red-500/10',
  // Summer badges
  'bagel': 'border-red-500/50 text-red-600 bg-red-500/10',
  'record': 'border-yellow-500/50 text-yellow-600 bg-yellow-500/10',
  'off-pace': 'border-amber-500/50 text-amber-600 bg-amber-500/10',
  'plateau': 'border-orange-500/50 text-orange-600 bg-orange-500/10',
  'work-ethic': 'border-slate-500/50 text-slate-600 bg-slate-500/10',
  'praise': 'border-emerald-500/50 text-emerald-600 bg-emerald-500/10',
  'check-in': 'border-blue-500/50 text-blue-600 bg-blue-500/10',
  'needs-review': 'border-indigo-500/50 text-indigo-600 bg-indigo-500/10',
};

const CONTAINER_STYLES: Record<string, string> = {
  'blitz-critical': 'border-red-500/30 bg-red-500/5',
  'blitz-prep': 'border-purple-500/30 bg-purple-500/5',
  'signed': 'border-emerald-500/30 bg-emerald-500/5',
  'hot-lead': 'border-orange-500/30 bg-orange-500/5',
  'pipeline': 'border-blue-500/30 bg-blue-500/5',
  'stale': 'border-amber-500/30 bg-amber-500/5',
  'overdue': 'border-red-500/30 bg-red-500/5',
  // Summer containers
  'bagel': 'border-red-500/30 bg-red-500/5',
  'record': 'border-yellow-500/30 bg-yellow-500/5',
  'off-pace': 'border-amber-500/30 bg-amber-500/5',
  'plateau': 'border-orange-500/30 bg-orange-500/5',
  'work-ethic': 'border-slate-500/30 bg-slate-500/5',
  'praise': 'border-emerald-500/30 bg-emerald-500/5',
  'check-in': 'border-blue-500/30 bg-blue-500/5',
  'needs-review': 'border-indigo-500/30 bg-indigo-500/5',
};

export const TodaysFocusHero = ({ 
  topRecommendation, 
  summerRecommendation,
  overdueScheduledFallback,
  todayScheduledItem,
  needsAttentionFallback,
  totalNeedsAttention,
  onRecruitClick,
  onSummerRepClick,
  onViewAll,
  onContactClick,
  onScheduleClick,
  onRescheduleActivityClick,
  onSkipForNow,
  onSkipToday,
  onLogOneOnOneClick,
  animatingOut = false,
  isLoading = false
}: TodaysFocusHeroProps) => {

  // Show skeleton while loading to prevent hero flash
  if (isLoading) {
    return (
      <div className="rounded-2xl border-2 border-border/50 bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-6 w-28" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-12 flex-1 rounded-xl" />
          <Skeleton className="h-12 flex-1 rounded-xl" />
        </div>
      </div>
    );
  }

  // Check if there's a blitz-critical recommendation that should take priority over overdue
  const blitzCriticalRecommendation = topRecommendation?.reasonBadge === 'blitz-critical' ? topRecommendation : null;

  // Priority 0: Blitz-Critical Rookies (highest urgency - they'll miss their blitz!)
  if (blitzCriticalRecommendation) {
    const recruit = blitzCriticalRecommendation.recruit;
    const firstName = recruit.name?.split(' ')[0] || 'Rookie';

    return (
      <div 
        className={cn(
          "rounded-2xl p-5 border-2 transition-all duration-300",
          CONTAINER_STYLES['blitz-critical'],
          animatingOut && "animate-fade-out opacity-0 scale-95"
        )}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-full bg-red-500/10">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <span className="text-sm font-medium text-red-600">🚨 Blitz Critical</span>
          <div className="ml-auto flex items-center gap-1">
            {blitzCriticalRecommendation.daysUntilBlitz !== undefined && (
              <Badge variant="outline" className="text-xs border-red-500/50 text-red-600 bg-red-500/10">
                Blitz in {blitzCriticalRecommendation.daysUntilBlitz}d
              </Badge>
            )}
            <SkipMenu 
              onSkipForNow={() => onSkipForNow?.(recruit)}
              onSkipToday={() => onSkipToday?.(recruit)}
              variant="ghost"
              size="sm"
              className="h-7 w-7"
            />
          </div>
        </div>

        <div 
          className="cursor-pointer"
          onClick={() => onRecruitClick(recruit)}
        >
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xl font-semibold">
              {stripEmojis(recruit.name)}
            </h2>
            <Badge 
              variant="outline" 
              className="text-xs border-muted-foreground/30 text-muted-foreground"
            >
              {recruit.stage}
            </Badge>
          </div>
          
          <p className="text-sm text-muted-foreground mb-3">
            {blitzCriticalRecommendation.reason}
          </p>
          
          {blitzCriticalRecommendation.missingItems && blitzCriticalRecommendation.missingItems.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {blitzCriticalRecommendation.missingItems.slice(0, 3).map((item) => (
                <Badge key={item} variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/30">
                  Missing: {item}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button 
            className="flex-1 gap-2"
            size="lg"
            variant="destructive"
            onClick={() => onContactClick?.(recruit)}
          >
            <UserRoundSearch className="h-4 w-4" />
            Contact Now
          </Button>
          <Button 
            variant="outline"
            size="lg"
            onClick={() => onRecruitClick(recruit)}
            className="gap-2"
          >
            View Details
          </Button>
        </div>
      </div>
    );
  }

  // Priority 1: Overdue Scheduled Items (scheduled tasks past due)
  if (overdueScheduledFallback) {
    const { recruit, activity, daysOverdue } = overdueScheduledFallback;
    const dueDate = activity.next_action_due ? parseISO(activity.next_action_due) : null;

    const handleOverdueSkipForNow = () => {
      onSkipForNow?.(recruit);
    };

    const handleOverdueSkipToday = () => {
      onSkipToday?.(recruit);
    };

    const handleOverdueContact = () => {
      onContactClick?.(recruit, activity);
    };

    const handleOverdueReschedule = () => {
      onRescheduleActivityClick?.(recruit, activity);
    };

    return (
      <div 
        className={cn(
          "rounded-2xl p-5 border-2 transition-all duration-300",
          "border-red-500/30 bg-red-500/5",
          animatingOut && "animate-fade-out opacity-0 scale-95"
        )}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-full bg-red-500/10">
            <Clock className="h-5 w-5 text-red-500" />
          </div>
          <span className="text-sm font-medium text-red-600">Overdue Follow-up</span>
          <div className="ml-auto flex items-center gap-1">
            <Badge variant="outline" className="text-xs border-red-500/50 text-red-600 bg-red-500/10">
              {daysOverdue === 1 ? '1 day late' : `${daysOverdue} days late`}
            </Badge>
            <SkipMenu 
              onSkipForNow={handleOverdueSkipForNow}
              onSkipToday={handleOverdueSkipToday}
              variant="ghost"
              size="sm"
              className="h-7 w-7"
            />
          </div>
        </div>

        <div 
          className="cursor-pointer"
          onClick={() => onRecruitClick(recruit)}
        >
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xl font-semibold">
              {stripEmojis(recruit.name)}
            </h2>
            <Badge 
              variant="outline" 
              className="text-xs border-muted-foreground/30 text-muted-foreground"
            >
              {recruit.stage}
            </Badge>
          </div>
          
          <p className="text-sm text-muted-foreground mb-3">
            {activity.next_action || 'Follow-up'} was due {dueDate ? format(dueDate, 'MMM d') : 'previously'}
          </p>
        </div>

        <div className="flex gap-2">
          <Button 
            className="flex-1 gap-2"
            size="lg"
            variant="destructive"
            onClick={handleOverdueContact}
          >
            <UserRoundSearch className="h-4 w-4" />
            Contact Now
          </Button>
          <Button 
            variant="outline"
            size="lg"
            onClick={handleOverdueReschedule}
            className="gap-2"
          >
            <Calendar className="h-4 w-4" />
            Reschedule
          </Button>
        </div>
      </div>
    );
  }

  // Priority 2: Today's Scheduled Items (tasks due today)
  if (todayScheduledItem) {
    const { recruit, activity } = todayScheduledItem;

    const handleTodaySkipForNow = () => {
      onSkipForNow?.(recruit);
    };

    const handleTodaySkipToday = () => {
      onSkipToday?.(recruit);
    };

    const handleTodayContact = () => {
      onContactClick?.(recruit, activity);
    };

    const handleTodayReschedule = () => {
      onRescheduleActivityClick?.(recruit, activity);
    };

    return (
      <div 
        className={cn(
          "rounded-2xl p-5 border-2 transition-all duration-300",
          "border-blue-500/30 bg-blue-500/5",
          animatingOut && "animate-fade-out opacity-0 scale-95"
        )}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-full bg-blue-500/10">
            <ClipboardList className="h-5 w-5 text-blue-500" />
          </div>
          <span className="text-sm font-medium text-blue-600">Scheduled for Today</span>
          <div className="ml-auto flex items-center gap-1">
            <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-600 bg-blue-500/10">
              Due today
            </Badge>
            <SkipMenu 
              onSkipForNow={handleTodaySkipForNow}
              onSkipToday={handleTodaySkipToday}
              variant="ghost"
              size="sm"
              className="h-7 w-7"
            />
          </div>
        </div>

        <div 
          className="cursor-pointer"
          onClick={() => onRecruitClick(recruit)}
        >
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xl font-semibold">
              {stripEmojis(recruit.name)}
            </h2>
            <Badge 
              variant="outline" 
              className="text-xs border-muted-foreground/30 text-muted-foreground"
            >
              {recruit.stage}
            </Badge>
          </div>
          
          <p className="text-sm text-muted-foreground mb-3">
            {activity.next_action || 'Follow-up'}
          </p>
        </div>

        <div className="flex gap-2">
          <Button 
            className="flex-1 gap-2"
            size="lg"
            onClick={handleTodayContact}
          >
            <UserRoundSearch className="h-4 w-4" />
            Contact Now
          </Button>
          <Button 
            variant="outline"
            size="lg"
            onClick={handleTodayReschedule}
            className="gap-2"
          >
            <Calendar className="h-4 w-4" />
            Reschedule
          </Button>
        </div>
      </div>
    );
  }

  // Determine which recommendation to show (summer BAGEL/RECORD/NEEDS-REVIEW takes priority)
  const showSummerPriority = summerRecommendation && 
    (summerRecommendation.reasonBadge === 'bagel' || summerRecommendation.reasonBadge === 'record');
  
  const showSummerNeedsReview = summerRecommendation && 
    summerRecommendation.reasonBadge === 'needs-review' && 
    !topRecommendation; // Only show if no preseason recommendation

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

  // Render Summer Hero (BAGEL or RECORD - highest priority summer alerts)
  if (showSummerPriority && summerRecommendation) {
    const isBagel = summerRecommendation.reasonBadge === 'bagel';
    const isRecord = summerRecommendation.reasonBadge === 'record';
    const firstName = summerRecommendation.rep.name?.split(' ')[0] || 'Rep';

    return (
      <div 
        className={cn(
          "rounded-2xl p-5 border-2 transition-all duration-300",
          CONTAINER_STYLES[summerRecommendation.reasonBadge],
          animatingOut && "animate-fade-out opacity-0 scale-95"
        )}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className={cn(
            "p-2 rounded-full",
            isBagel ? "bg-red-500/10" : "bg-yellow-500/10"
          )}>
            {isBagel ? (
              <Flame className="h-5 w-5 text-red-500" />
            ) : (
              <Trophy className="h-5 w-5 text-yellow-500" />
            )}
          </div>
          <span className={cn(
            "text-sm font-medium",
            isBagel ? "text-red-600" : "text-yellow-600"
          )}>
            {isBagel ? "🚨 Urgent: BAGEL Alert" : "🏆 Record Breaker!"}
          </span>
          <Badge variant="outline" className={cn("ml-auto text-xs", BADGE_STYLES[summerRecommendation.reasonBadge])}>
            {summerRecommendation.rep.year}
          </Badge>
        </div>

        <div 
          className="cursor-pointer"
          onClick={() => onSummerRepClick?.(summerRecommendation.rep.notionPageId)}
        >
          <h2 className="text-xl font-semibold mb-2">
            {firstName}
          </h2>
          
          <p className="text-sm text-muted-foreground mb-3">
            {summerRecommendation.reason}
          </p>

          {isBagel && summerRecommendation.details?.knockingDays && (
            <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/30">
              {summerRecommendation.details.knockingDays} knocking days, 0 sales
            </Badge>
          )}

          {isRecord && summerRecommendation.details && (
            <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
              New {summerRecommendation.details.recordType} {summerRecommendation.details.recordPeriod} record!
            </Badge>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <Button 
            className="flex-1 gap-2"
            size="lg"
            variant={isBagel ? "destructive" : "default"}
            onClick={() => onSummerRepClick?.(summerRecommendation.rep.notionPageId)}
          >
            {isBagel ? "Help Now" : "Celebrate"}
          </Button>
        </div>
      </div>
    );
  }

  // Render Summer Needs Monthly Review Hero (shows when no other recommendations)
  if (showSummerNeedsReview && summerRecommendation) {
    const firstName = summerRecommendation.rep.name?.split(' ')[0] || 'Rep';

    return (
      <div 
        className={cn(
          "rounded-2xl p-5 border-2 transition-all duration-300",
          CONTAINER_STYLES['needs-review'],
          animatingOut && "animate-fade-out opacity-0 scale-95"
        )}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-full bg-indigo-500/10">
            <ClipboardList className="h-5 w-5 text-indigo-500" />
          </div>
          <span className="text-sm font-medium text-indigo-600">📅 Monthly 1-on-1 Due</span>
          <Badge variant="outline" className={cn("ml-auto text-xs", BADGE_STYLES['needs-review'])}>
            {summerRecommendation.rep.year}
          </Badge>
        </div>

        <div 
          className="cursor-pointer"
          onClick={() => onSummerRepClick?.(summerRecommendation.rep.notionPageId)}
        >
          <h2 className="text-xl font-semibold mb-2">
            {firstName}
          </h2>
          
          <p className="text-sm text-muted-foreground mb-3">
            {summerRecommendation.reason}
          </p>
        </div>

        <div className="flex gap-2 mt-4">
          <Button 
            className="flex-1 gap-2"
            size="lg"
            onClick={() => onLogOneOnOneClick?.(summerRecommendation.rep.userId, summerRecommendation.rep.name)}
          >
            <ClipboardList className="h-4 w-4" />
            Log 1-on-1
          </Button>
          <Button 
            variant="outline"
            size="lg"
            onClick={() => onSummerRepClick?.(summerRecommendation.rep.notionPageId)}
            className="gap-2"
          >
            View Details
          </Button>
        </div>
      </div>
    );
  }

  // Default preseason/recruiting hero - show fallbacks when no recommendation
  if (!topRecommendation) {
    // Needs attention fallback
    if (needsAttentionFallback) {
      const fallbackRecruit = needsAttentionFallback.recruit;
      const urgencyStyles = {
        high: 'border-red-500/30 bg-red-500/5',
        medium: 'border-amber-500/30 bg-amber-500/5',
        low: 'border-blue-500/30 bg-blue-500/5',
      };
      const urgencyBadgeStyles = {
        high: 'border-red-500/50 text-red-600 bg-red-500/10',
        medium: 'border-amber-500/50 text-amber-600 bg-amber-500/10',
        low: 'border-blue-500/50 text-blue-600 bg-blue-500/10',
      };

      const handleFallbackSkipForNow = () => {
        onSkipForNow?.(fallbackRecruit);
      };

      const handleFallbackSkipToday = () => {
        onSkipToday?.(fallbackRecruit);
      };

      const handleFallbackContact = () => {
        onContactClick?.(fallbackRecruit);
      };

      const handleFallbackSchedule = () => {
        onScheduleClick?.(fallbackRecruit);
      };

      return (
        <div 
          className={cn(
            "rounded-2xl p-5 border-2 transition-all duration-300",
            urgencyStyles[needsAttentionFallback.urgency],
            animatingOut && "animate-fade-out opacity-0 scale-95"
          )}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-full bg-amber-500/10">
              <Bell className="h-5 w-5 text-amber-500" />
            </div>
            <span className="text-sm font-medium text-amber-600">Needs Attention</span>
            <div className="ml-auto flex items-center gap-1">
              <Badge variant="outline" className={cn("text-xs", urgencyBadgeStyles[needsAttentionFallback.urgency])}>
                {needsAttentionFallback.urgency === 'high' ? 'Urgent' : needsAttentionFallback.urgency === 'medium' ? 'Soon' : 'Check In'}
              </Badge>
              <SkipMenu 
                onSkipForNow={handleFallbackSkipForNow}
                onSkipToday={handleFallbackSkipToday}
                variant="ghost"
                size="sm"
                className="h-7 w-7"
              />
            </div>
          </div>

          <div 
            className="cursor-pointer"
            onClick={() => onRecruitClick(fallbackRecruit)}
          >
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-xl font-semibold">
                {stripEmojis(fallbackRecruit.name)}
              </h2>
              <Badge 
                variant="outline" 
                className="text-xs border-muted-foreground/30 text-muted-foreground"
              >
                {fallbackRecruit.stage}
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground mb-3">
              {needsAttentionFallback.reason}
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              className="flex-1 gap-2"
              size="lg"
              onClick={handleFallbackContact}
            >
              <UserRoundSearch className="h-4 w-4" />
              Contact
            </Button>
            <Button 
              variant="outline"
              size="lg"
              onClick={handleFallbackSchedule}
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              Schedule
            </Button>
          </div>
        </div>
      );
    }

    // Truly all caught up - no recommendations AND no needs attention
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
