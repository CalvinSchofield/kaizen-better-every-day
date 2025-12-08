import { useState, useRef } from "react";
import { motion, useMotionValue, useTransform, PanInfo, useAnimation } from "framer-motion";
import { Phone, MessageSquare, ChevronRight, Check, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AttentionRecruit } from "@/hooks/useNeedsAttention";
import { Recruit } from "@/hooks/useGroupRecruits";
import { cn } from "@/lib/utils";
import { BlitzCommitmentDrawer } from "./BlitzCommitmentDrawer";

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

interface BlitzEvent {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  location?: string;
}

interface SwipeableBlitzItemProps {
  item: AttentionRecruit;
  onRecruitClick: (recruit: Recruit) => void;
  onDrawerClose: () => void;
  onSchedule?: (recruit: Recruit) => void;
  onContact?: (recruit: Recruit) => void;
  blitzes: BlitzEvent[];
  repDataMap?: Map<string, any>;
}

export const SwipeableBlitzItem = ({
  item,
  onRecruitClick,
  onDrawerClose,
  onSchedule,
  onContact,
  blitzes,
  repDataMap,
}: SwipeableBlitzItemProps) => {
  const [isCommitted, setIsCommitted] = useState<'left' | 'right' | null>(null);
  const [blitzDrawerOpen, setBlitzDrawerOpen] = useState(false);
  const constraintsRef = useRef(null);
  const x = useMotionValue(0);
  const controls = useAnimation();

  const repData = repDataMap?.get(item.recruit.notionPageId);
  const rawCommitments = repData?.committed_blitzes || [];
  const currentCommitments: string[] = Array.isArray(rawCommitments)
    ? rawCommitments.map((b: string | { id: string }) => typeof b === 'string' ? b : b.id)
    : [];

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
    onContact?.(item.recruit);
  };

  const handleText = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `sms:${item.recruit.phone}`;
    onContact?.(item.recruit);
  };

  return (
    <>
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
            "bg-card rounded-lg p-4 border border-l-4 shadow-sm cursor-grab active:cursor-grabbing relative",
            URGENCY_STYLES[item.urgency],
            isCommitted && "shadow-lg"
          )}
        >
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

          {/* Blitz commitment section */}
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {currentCommitments.length === 0 
                    ? 'No blitzes committed' 
                    : `${currentCommitments.length} blitz${currentCommitments.length > 1 ? 'es' : ''} committed`
                  }
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setBlitzDrawerOpen(true);
                }}
              >
                {currentCommitments.length === 0 ? 'Commit to Blitz' : 'Manage'}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      <BlitzCommitmentDrawer
        open={blitzDrawerOpen}
        onOpenChange={setBlitzDrawerOpen}
        recruitName={stripEmojis(item.recruit.name) || item.recruit.name}
        recruitNotionPageId={item.recruit.notionPageId}
        currentCommitments={currentCommitments}
        availableBlitzes={blitzes}
      />
    </>
  );
};