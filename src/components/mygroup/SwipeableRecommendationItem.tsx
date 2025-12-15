import { useState, useRef } from "react";
import { motion, useMotionValue, useTransform, PanInfo, useAnimation } from "framer-motion";
import { Phone, MessageSquare, ChevronRight, Check, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecruitRecommendation } from "@/hooks/useRecruitingRecommendations";
import { Recruit } from "@/hooks/useGroupRecruits";
import { cn } from "@/lib/utils";
import { SkipMenu } from "./SkipMenu";

// Sticky threshold - must drag past this to commit
const SWIPE_COMMIT_THRESHOLD = 100;
// Visual feedback starts at this point
const SWIPE_VISUAL_THRESHOLD = 40;

const BADGE_STYLES: Record<RecruitRecommendation['reasonBadge'], string> = {
  'blitz-critical': 'bg-red-500/20 text-red-600 border-red-500/30',
  'blitz-prep': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'signed': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'hot-lead': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  'pipeline': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'stale': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'overdue': 'bg-red-500/10 text-red-600 border-red-500/20',
};

// Strip emojis from name
const stripEmojis = (text: string | null): string | null => {
  if (!text) return null;
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
};

interface SwipeableRecommendationItemProps {
  recommendation: RecruitRecommendation;
  onRecruitClick: (recruit: Recruit) => void;
  onSchedule?: (recruit: Recruit) => void;
  onContact?: (recruit: Recruit) => void;
  onDirectCall?: (recruit: Recruit) => void;
  onDirectText?: (recruit: Recruit) => void;
  onSkipForNow?: (recruit: Recruit) => void;
  onSkipToday?: (recruit: Recruit) => void;
}

export const SwipeableRecommendationItem = ({
  recommendation,
  onRecruitClick,
  onSchedule,
  onContact,
  onDirectCall,
  onDirectText,
  onSkipForNow,
  onSkipToday,
}: SwipeableRecommendationItemProps) => {
  const [isCommitted, setIsCommitted] = useState<'left' | 'right' | null>(null);
  const constraintsRef = useRef(null);
  const x = useMotionValue(0);
  const controls = useAnimation();

  // Transform for background action indicators
  const leftScale = useTransform(x, [SWIPE_VISUAL_THRESHOLD, SWIPE_COMMIT_THRESHOLD], [0.8, 1.1]);
  const rightScale = useTransform(x, [-SWIPE_COMMIT_THRESHOLD, -SWIPE_VISUAL_THRESHOLD], [1.1, 0.8]);

  // Track if we've crossed the commit threshold
  x.on("change", (latest) => {
    if (latest > SWIPE_COMMIT_THRESHOLD) {
      setIsCommitted('right');
    } else if (latest < -SWIPE_COMMIT_THRESHOLD) {
      setIsCommitted('left');
    } else {
      setIsCommitted(null);
    }
  });

  const handleDragEnd = async (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const offset = info.offset.x;
    
    if (offset > SWIPE_COMMIT_THRESHOLD) {
      // Swipe right = Open contact drawer
      await controls.start({ x: 0 });
      onContact?.(recommendation.recruit);
    } else if (offset < -SWIPE_COMMIT_THRESHOLD) {
      // Swipe left = Open schedule drawer
      await controls.start({ x: 0 });
      onSchedule?.(recommendation.recruit);
    } else {
      // Snap back if not committed
      controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 30 } });
    }
    setIsCommitted(null);
  };

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `tel:${recommendation.recruit.phone}`;
    // Open post-contact drawer for calls
    onDirectCall?.(recommendation.recruit);
  };

  const handleText = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `sms:${recommendation.recruit.phone}`;
    // Open post-contact drawer for texts
    onDirectText?.(recommendation.recruit);
  };

  return (
    <div ref={constraintsRef} className="relative overflow-hidden rounded-lg">
      {/* Left action background (Contacted) - swipe right */}
      <motion.div 
        className={cn(
          "absolute inset-y-0 left-0 w-28 flex items-center justify-center rounded-l-lg transition-colors",
          isCommitted === 'right' ? "bg-green-600" : "bg-green-500"
        )}
        style={{ opacity: useTransform(x, [0, SWIPE_VISUAL_THRESHOLD, SWIPE_COMMIT_THRESHOLD], [0, 0.7, 1]) }}
      >
        <motion.div style={{ scale: leftScale }} className="flex flex-col items-center gap-1">
          <Check className="h-6 w-6 text-white" />
          <span className="text-xs text-white font-medium">Contact</span>
        </motion.div>
      </motion.div>

      {/* Right action background (Schedule) - swipe left */}
      <motion.div 
        className={cn(
          "absolute inset-y-0 right-0 w-28 flex items-center justify-center rounded-r-lg transition-colors",
          isCommitted === 'left' ? "bg-blue-600" : "bg-blue-500"
        )}
        style={{ opacity: useTransform(x, [-SWIPE_COMMIT_THRESHOLD, -SWIPE_VISUAL_THRESHOLD, 0], [1, 0.7, 0]) }}
      >
        <motion.div style={{ scale: rightScale }} className="flex flex-col items-center gap-1">
          <Calendar className="h-6 w-6 text-white" />
          <span className="text-xs text-white font-medium">Schedule</span>
        </motion.div>
      </motion.div>

      {/* Swipeable card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -140, right: 140 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        style={{ x }}
        animate={controls}
        whileTap={{ cursor: 'grabbing' }}
        className={cn(
          "bg-card rounded-lg p-3 border shadow-sm cursor-grab active:cursor-grabbing relative",
          isCommitted && "shadow-lg"
        )}
      >
        {/* Main content */}
        <div 
          className="flex items-start justify-between gap-2"
          onClick={() => onRecruitClick(recommendation.recruit)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">
                {stripEmojis(recommendation.recruit.name)}
              </span>
              <Badge 
                variant="outline" 
                className={cn("text-xs px-1.5 py-0", BADGE_STYLES[recommendation.reasonBadge])}
              >
                {recommendation.reason}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {recommendation.recruit.stage}
              </Badge>
              {recommendation.scheduledFollowUp?.isDueToday && (
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                  <Calendar className="h-3 w-3 mr-1" />
                  Due Today
                </Badge>
              )}
              {recommendation.daysSinceContact !== null && (
                <span className="text-xs text-muted-foreground">
                  {recommendation.daysSinceContact}d ago
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <SkipMenu
              onSkipForNow={() => onSkipForNow?.(recommendation.recruit)}
              onSkipToday={() => onSkipToday?.(recommendation.recruit)}
              className="h-8 w-8"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleCall}
            >
              <Phone className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleText}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <ChevronRight className="h-4 w-4 text-muted-foreground mt-2" />
          </div>
        </div>
      </motion.div>
    </div>
  );
};