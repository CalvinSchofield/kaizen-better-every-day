import { useState, useRef } from "react";
import { motion, useMotionValue, useTransform, PanInfo, useAnimation } from "framer-motion";
import { Phone, MessageSquare, ChevronRight, Check, Calendar, Tablet, BookOpen, Target, Users, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AttentionRecruit } from "@/hooks/useNeedsAttention";
import { Recruit } from "@/hooks/useGroupRecruits";
import { cn } from "@/lib/utils";
import { differenceInDays, parseISO, isAfter, isBefore, startOfToday, isSameDay, format } from "date-fns";

// Sticky threshold - must drag past this to commit
const SWIPE_COMMIT_THRESHOLD = 100;
// Visual feedback starts at this point
const SWIPE_VISUAL_THRESHOLD = 40;

const URGENCY_STYLES = {
  high: 'border-l-red-500',
  medium: 'border-l-amber-500',
  low: 'border-l-green-500',
};

// Strip emojis from name
const stripEmojis = (text: string | null): string | null => {
  if (!text) return null;
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
};

interface SwipeableRecruitItemProps {
  item: AttentionRecruit;
  onRecruitClick: (recruit: Recruit) => void;
  onDrawerClose: () => void;
  onSchedule?: (recruit: Recruit) => void;
  onContact?: (recruit: Recruit) => void;
  onDirectCall?: (recruit: Recruit) => void;
  onDirectText?: (recruit: Recruit) => void;
  repData?: {
    ipad_assigned?: boolean;
    onboarding_complete?: boolean;
    ramp_phase_1_complete?: boolean;
    ramp_phase_2_complete?: boolean;
    ramp_phase_3_complete?: boolean;
    ramp_phase_4_complete?: boolean;
  } | null;
}

export const SwipeableRecruitItem = ({
  item,
  onRecruitClick,
  onDrawerClose,
  onSchedule,
  onContact,
  onDirectCall,
  onDirectText,
  repData,
}: SwipeableRecruitItemProps) => {
  const [isCommitted, setIsCommitted] = useState<'left' | 'right' | null>(null);
  const constraintsRef = useRef(null);
  const x = useMotionValue(0);
  const controls = useAnimation();

  // Transform for background action indicators
  const leftBgOpacity = useTransform(x, [SWIPE_VISUAL_THRESHOLD, SWIPE_COMMIT_THRESHOLD], [0.5, 1]);
  const rightBgOpacity = useTransform(x, [-SWIPE_COMMIT_THRESHOLD, -SWIPE_VISUAL_THRESHOLD], [1, 0.5]);
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
      onContact?.(item.recruit);
    } else if (offset < -SWIPE_COMMIT_THRESHOLD) {
      // Swipe left = Open schedule drawer
      await controls.start({ x: 0 });
      onSchedule?.(item.recruit);
    } else {
      // Snap back if not committed
      controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 30 } });
    }
    setIsCommitted(null);
  };

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `tel:${item.recruit.phone}`;
    // Open post-contact drawer for calls
    onDirectCall?.(item.recruit);
  };

  const handleText = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `sms:${item.recruit.phone}`;
    // Open post-contact drawer for texts
    onDirectText?.(item.recruit);
  };

  // Get blockers based on rep data - only for Rookies (vets/sophomores don't need ramp-to-blitz training)
  const getBlockers = () => {
    const blockers: { icon: 'ipad' | 'onboarding' | 'ramp'; label: string }[] = [];
    
    // Only show blocker icons for Rookies
    const isRookie = item.recruit.year === 'Rookie' || item.recruit.year === '2025' || item.recruit.year === '2026';
    if (!isRookie) return blockers;
    
    if (repData) {
      if (!repData.ipad_assigned) {
        blockers.push({ icon: 'ipad', label: 'Missing iPad' });
      }
      
      // If any ramp phase is complete, onboarding is done (can't start ramp without completing onboarding)
      const hasAnyRampProgress = repData.ramp_phase_1_complete || 
        repData.ramp_phase_2_complete || 
        repData.ramp_phase_3_complete || 
        repData.ramp_phase_4_complete;
      const effectiveOnboardingComplete = repData.onboarding_complete || hasAnyRampProgress;
      
      if (!effectiveOnboardingComplete) {
        blockers.push({ icon: 'onboarding', label: 'Onboarding Incomplete' });
      }
      
      const hasIncompleteRamp = !repData.ramp_phase_1_complete || 
        !repData.ramp_phase_2_complete || 
        !repData.ramp_phase_3_complete || 
        !repData.ramp_phase_4_complete;
      if (hasIncompleteRamp && effectiveOnboardingComplete) {
        blockers.push({ icon: 'ramp', label: 'Ramp Phases Incomplete' });
      }
    }
    
    return blockers;
  };

  // Get upcoming blitz info
  const getUpcomingBlitz = () => {
    if (!item.recruit.committedBlitzes || item.recruit.committedBlitzes.length === 0) return null;
    
    const today = startOfToday();
    const upcomingBlitzes = item.recruit.committedBlitzes
      .filter(b => b.date)
      .map(b => ({ ...b, startDate: parseISO(b.date) }))
      .filter(b => isAfter(b.startDate, today) || isSameDay(b.startDate, today))
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    
    if (upcomingBlitzes.length === 0) return null;
    
    const nextBlitz = upcomingBlitzes[0];
    const daysUntil = differenceInDays(nextBlitz.startDate, today);
    
    return {
      name: nextBlitz.name,
      daysUntil,
      isUrgent: daysUntil <= 7,
      isWarning: daysUntil <= 14,
    };
  };

  // Get scheduled follow-up
  const getScheduledFollowUp = () => {
    if (!item.recruit.nextActionDue) return null;
    const dueDate = parseISO(item.recruit.nextActionDue);
    const today = startOfToday();
    const isToday = isSameDay(dueDate, today);
    return {
      isToday,
      label: isToday ? 'Today' : format(dueDate, 'MMM d'),
    };
  };

  const blockers = getBlockers();
  const upcomingBlitz = getUpcomingBlitz();
  const followUp = getScheduledFollowUp();

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
          <span className="text-xs text-white font-medium">Contacted</span>
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
          "bg-card rounded-lg p-3 border border-l-4 shadow-sm cursor-grab active:cursor-grabbing relative",
          URGENCY_STYLES[item.urgency],
          isCommitted && "shadow-lg"
        )}
      >
        {/* Row 1: Name + Blocker icons */}
        <div 
          className="flex items-start justify-between gap-2"
          onClick={() => {
            onRecruitClick(item.recruit);
            onDrawerClose();
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">
                {stripEmojis(item.recruit.name)}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                {blockers.map((blocker, idx) => (
                  <span key={idx} className="text-amber-500">
                    {blocker.icon === 'ipad' && <Tablet className="h-3.5 w-3.5" />}
                    {blocker.icon === 'onboarding' && <BookOpen className="h-3.5 w-3.5" />}
                    {blocker.icon === 'ramp' && <Target className="h-3.5 w-3.5" />}
                  </span>
                ))}
              </div>
            </div>
            
            {/* Row 2: Team name */}
            {item.recruit.teamName && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Users className="h-3 w-3" />
                <span className="truncate">{item.recruit.teamName}</span>
              </div>
            )}
            
            {/* Row 3: Badges - follow-up, days since contact, blitz countdown */}
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              {/* Scheduled follow-up badge */}
              {followUp && (
                <Badge 
                  variant="outline" 
                  className={`text-[10px] px-1.5 py-0 ${followUp.isToday 
                    ? "bg-primary/10 text-primary border-primary/30" 
                    : "bg-blue-500/10 text-blue-600 border-blue-500/30"
                  }`}
                >
                  <Clock className="h-2.5 w-2.5 mr-0.5" />
                  {followUp.label}
                </Badge>
              )}

              {/* Days since contact */}
              {item.daysSinceContact !== undefined && (
                <Badge 
                  variant="outline" 
                  className={`text-[10px] px-1.5 py-0 ${item.daysSinceContact >= 7 ? 'text-amber-600 border-amber-500/30' : 'text-muted-foreground'}`}
                >
                  {item.daysSinceContact}d ago
                </Badge>
              )}

              {/* Blitz countdown */}
              {upcomingBlitz && (
                <Badge 
                  variant="outline" 
                  className={`text-[10px] px-1.5 py-0 ${
                    upcomingBlitz.isUrgent 
                      ? 'bg-red-500/10 text-red-600 border-red-500/30' 
                      : upcomingBlitz.isWarning 
                        ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                        : 'bg-green-500/10 text-green-600 border-green-500/30'
                  }`}
                >
                  🎯 {upcomingBlitz.daysUntil}d
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex gap-1 flex-shrink-0">
            {item.recruit.phone && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={handleCall}
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={handleText}
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground mt-2.5" />
          </div>
        </div>
      </motion.div>
    </div>
  );
};
