import { useState, useRef } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Phone, MessageSquare, ChevronRight, Check, Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AttentionRecruit } from "@/hooks/useNeedsAttention";
import { Recruit, useLogRecruitActivity, useUpdateRecruitStage } from "@/hooks/useGroupRecruits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SWIPE_THRESHOLD = 80;

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
}

export const SwipeableRecruitItem = ({
  item,
  onRecruitClick,
  onDrawerClose,
  onSchedule,
}: SwipeableRecruitItemProps) => {
  const [isActioning, setIsActioning] = useState(false);
  const constraintsRef = useRef(null);
  const x = useMotionValue(0);
  
  const logActivityMutation = useLogRecruitActivity();
  const updateStageMutation = useUpdateRecruitStage();

  // Transform for background action indicators
  const leftBgOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const rightBgOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);
  const leftScale = useTransform(x, [0, SWIPE_THRESHOLD], [0.5, 1]);
  const rightScale = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0.5]);

  const handleDragEnd = async (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const offset = info.offset.x;
    
    if (offset > SWIPE_THRESHOLD) {
      // Swipe right = Contacted
      setIsActioning(true);
      try {
        await logActivityMutation.mutateAsync({
          recruitNotionId: item.recruit.notionPageId,
          activityType: 'phone_call',
          notes: 'Contacted via quick action',
          updateLastContact: true,
        });
        toast.success(`Marked ${stripEmojis(item.recruit.name)} as contacted`);
      } catch (error) {
        console.error('Failed to log contact:', error);
        toast.error('Failed to log contact');
      } finally {
        setIsActioning(false);
      }
    } else if (offset < -SWIPE_THRESHOLD) {
      // Swipe left = Drop (move to Potential Follow Up)
      setIsActioning(true);
      try {
        await updateStageMutation.mutateAsync({
          recruitNotionId: item.recruit.notionPageId,
          newStage: 'Potential Follow Up',
        });
        toast.success(`Moved ${stripEmojis(item.recruit.name)} to Follow Up`);
      } catch (error) {
        console.error('Failed to update stage:', error);
        toast.error('Failed to update stage');
      } finally {
        setIsActioning(false);
      }
    }
  };

  const handleCall = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await logActivityMutation.mutateAsync({
        recruitNotionId: item.recruit.notionPageId,
        activityType: 'phone_call',
        notes: 'Call attempt',
        updateLastContact: true,
      });
      toast.success('Call logged');
    } catch (error) {
      console.error('Failed to log call:', error);
    }
    window.location.href = `tel:${item.recruit.phone}`;
  };

  const handleText = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `sms:${item.recruit.phone}`;
  };

  const handleScheduleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSchedule?.(item.recruit);
  };

  return (
    <div ref={constraintsRef} className="relative overflow-hidden rounded-lg">
      {/* Left action background (Contacted) */}
      <motion.div 
        className="absolute inset-y-0 left-0 w-24 bg-green-500 flex items-center justify-center rounded-l-lg"
        style={{ opacity: leftBgOpacity }}
      >
        <motion.div style={{ scale: leftScale }}>
          <Check className="h-6 w-6 text-white" />
        </motion.div>
      </motion.div>

      {/* Right action background (Drop) */}
      <motion.div 
        className="absolute inset-y-0 right-0 w-24 bg-red-500 flex items-center justify-center rounded-r-lg"
        style={{ opacity: rightBgOpacity }}
      >
        <motion.div style={{ scale: rightScale }}>
          <X className="h-6 w-6 text-white" />
        </motion.div>
      </motion.div>

      {/* Swipeable card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -120, right: 120 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        whileTap={{ cursor: 'grabbing' }}
        className={cn(
          "bg-card rounded-lg p-4 border border-l-4 shadow-sm cursor-grab active:cursor-grabbing relative",
          URGENCY_STYLES[item.urgency],
          isActioning && "opacity-50 pointer-events-none"
        )}
      >
        {/* Quick action buttons row */}
        <div className="flex gap-1.5 mb-3">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 h-8 text-xs gap-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-600"
            onClick={async (e) => {
              e.stopPropagation();
              setIsActioning(true);
              try {
                await logActivityMutation.mutateAsync({
                  recruitNotionId: item.recruit.notionPageId,
                  activityType: 'phone_call',
                  notes: 'Contacted via quick action',
                  updateLastContact: true,
                });
                toast.success('Marked as contacted');
              } catch (error) {
                toast.error('Failed to log contact');
              } finally {
                setIsActioning(false);
              }
            }}
          >
            <Check className="h-3.5 w-3.5" />
            Contacted
          </Button>
          
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 h-8 text-xs gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600"
            onClick={handleScheduleClick}
          >
            <Calendar className="h-3.5 w-3.5" />
            Schedule
          </Button>
          
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 h-8 text-xs gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600"
            onClick={async (e) => {
              e.stopPropagation();
              setIsActioning(true);
              try {
                await updateStageMutation.mutateAsync({
                  recruitNotionId: item.recruit.notionPageId,
                  newStage: 'Potential Follow Up',
                });
                toast.success('Moved to Follow Up');
              } catch (error) {
                toast.error('Failed to update');
              } finally {
                setIsActioning(false);
              }
            }}
          >
            <X className="h-3.5 w-3.5" />
            Drop
          </Button>
        </div>

        {/* Main content */}
        <div 
          className="flex items-start justify-between gap-3"
          onClick={() => {
            onRecruitClick(item.recruit);
            onDrawerClose();
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-medium">
                {stripEmojis(item.recruit.name)}
              </span>
              <Badge variant="outline" className="text-xs">
                {item.recruit.stage}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {item.reason}
            </p>
            {item.recruit.teamName && (
              <p className="text-xs text-muted-foreground mt-1">
                {item.recruit.teamName}
              </p>
            )}
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
