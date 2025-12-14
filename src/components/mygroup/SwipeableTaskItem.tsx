import { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform, PanInfo, useAnimation } from "framer-motion";
import { Phone, MessageSquare, ChevronRight, Check, Calendar, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Recruit, RecruitActivity } from "@/hooks/useGroupRecruits";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Sticky threshold - must drag past this to commit
const SWIPE_COMMIT_THRESHOLD = 100;
// Visual feedback starts at this point
const SWIPE_VISUAL_THRESHOLD = 40;

// Strip emojis from name
const stripEmojis = (text: string | null): string | null => {
  if (!text) return null;
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
};

interface SwipeableTaskItemProps {
  recruit: Recruit;
  activity?: RecruitActivity | null;
  reason?: string;
  reasonBadge?: string;
  daysSinceContact?: number | null;
  onRecruitClick: (recruit: Recruit) => void;
  onSchedule?: (recruit: Recruit) => void;
  onContact?: (recruit: Recruit) => void;
  onDirectCall?: (recruit: Recruit) => void;
  onDirectText?: (recruit: Recruit) => void;
  showSwipeDemo?: boolean;
  onDemoComplete?: () => void;
  isOverdue?: boolean;
}

export const SwipeableTaskItem = ({
  recruit,
  activity,
  reason,
  reasonBadge,
  daysSinceContact,
  onRecruitClick,
  onSchedule,
  onContact,
  onDirectCall,
  onDirectText,
  showSwipeDemo = false,
  onDemoComplete,
  isOverdue = false,
}: SwipeableTaskItemProps) => {
  const [isCommitted, setIsCommitted] = useState<'left' | 'right' | null>(null);
  const [demoPlayed, setDemoPlayed] = useState(false);
  const constraintsRef = useRef(null);
  const x = useMotionValue(0);
  const controls = useAnimation();

  // Get current user ID to compare with assigned_to_user_id
  const { data: currentUserId } = useQuery({
    queryKey: ['current-user-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    },
    staleTime: Infinity,
  });

  // Check if task is assigned to someone else
  const isAssignedToOther = activity?.assigned_to_user_id && 
    activity.assigned_to_user_id !== currentUserId;

  // Get assignee name if assigned to someone else
  const { data: assigneeName } = useQuery({
    queryKey: ['assignee-name', activity?.assigned_to_user_id],
    queryFn: async () => {
      if (!activity?.assigned_to_user_id) return null;
      const { data } = await supabase
        .from('reps')
        .select('name')
        .eq('user_id', activity.assigned_to_user_id)
        .single();
      if (!data) return null;
      const cleanName = stripEmojis(data.name);
      return cleanName?.split(' ')[0] || null;
    },
    enabled: !!isAssignedToOther,
    staleTime: 5 * 60 * 1000,
  });

  // Play demo animation on mount if requested
  useEffect(() => {
    if (showSwipeDemo && !demoPlayed) {
      const playDemo = async () => {
        await new Promise(resolve => setTimeout(resolve, 800));
        // Swipe right demo
        await controls.start({ x: 60, transition: { duration: 0.4, ease: "easeOut" } });
        await new Promise(resolve => setTimeout(resolve, 300));
        await controls.start({ x: 0, transition: { duration: 0.3, ease: "easeInOut" } });
        await new Promise(resolve => setTimeout(resolve, 400));
        // Swipe left demo
        await controls.start({ x: -60, transition: { duration: 0.4, ease: "easeOut" } });
        await new Promise(resolve => setTimeout(resolve, 300));
        await controls.start({ x: 0, transition: { duration: 0.3, ease: "easeInOut" } });
        setDemoPlayed(true);
        onDemoComplete?.();
      };
      playDemo();
    }
  }, [showSwipeDemo, demoPlayed, controls, onDemoComplete]);

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
      onContact?.(recruit);
    } else if (offset < -SWIPE_COMMIT_THRESHOLD) {
      // Swipe left = Open schedule drawer
      await controls.start({ x: 0 });
      onSchedule?.(recruit);
    } else {
      // Snap back if not committed
      controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 30 } });
    }
    setIsCommitted(null);
  };

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `tel:${recruit.phone}`;
    // Open post-contact drawer for calls
    onDirectCall?.(recruit);
  };

  const handleText = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `sms:${recruit.phone}`;
    // Open post-contact drawer for texts
    onDirectText?.(recruit);
  };

  // Determine what to display as the action/reason text
  const displayReason = activity?.next_action || reason;

  return (
    <div ref={constraintsRef} className="relative overflow-hidden rounded-lg">
      {/* Left action background (Contact) - swipe right */}
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
          isCommitted && "shadow-lg",
          isOverdue && "border-destructive/50 bg-destructive/5"
        )}
      >
        {/* Main content */}
        <div 
          className="flex items-start justify-between gap-2"
          onClick={() => onRecruitClick(recruit)}
        >
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">
              {stripEmojis(recruit.name)}
            </div>
            {displayReason && (
              <div className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded mt-1 inline-block">
                {displayReason}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {recruit.stage}
              </Badge>
              {/* Show assignee badge if assigned to someone else */}
              {isAssignedToOther && assigneeName && (
                <Badge variant="outline" className="text-[10px] gap-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30">
                  <UserCircle className="h-3 w-3" />
                  {assigneeName}
                </Badge>
              )}
              {daysSinceContact !== null && daysSinceContact !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {daysSinceContact}d ago
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
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
