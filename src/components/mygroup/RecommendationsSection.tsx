import { useState } from "react";
import { Sparkles } from "lucide-react";
import { RecruitRecommendation } from "@/hooks/useRecruitingRecommendations";
import { Recruit } from "@/hooks/useGroupRecruits";
import { ContactMethodDrawer } from "./ContactMethodDrawer";
import { ScheduleFollowUpDrawer } from "./ScheduleFollowUpDrawer";
import { PostContactDrawer } from "./PostContactDrawer";
import { SwipeableRecommendationItem } from "./SwipeableRecommendationItem";
import { AnimatePresence, motion } from "framer-motion";

interface RecommendationsSectionProps {
  recommendations: RecruitRecommendation[];
  onRecruitClick: (recruit: RecruitRecommendation['recruit']) => void;
  maxItems?: number;
  dismissedIds?: Set<string>;
  onDismiss?: (recruit: Recruit, message: string) => void;
}

export const RecommendationsSection = ({ 
  recommendations, 
  onRecruitClick,
  maxItems = 5,
  dismissedIds,
  onDismiss,
}: RecommendationsSectionProps) => {
  // Contact method drawer state (Call/Text/In Person options)
  const [contactRecruit, setContactRecruit] = useState<Recruit | null>(null);
  
  // Schedule drawer state
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedulingRecruit, setSchedulingRecruit] = useState<Recruit | null>(null);

  // Post-contact drawer state (for direct call/text flow)
  const [postContactOpen, setPostContactOpen] = useState(false);
  const [postContactRecruit, setPostContactRecruit] = useState<Recruit | null>(null);
  const [postContactMethod, setPostContactMethod] = useState<'call' | 'text'>('call');

  // Animating out state for individual cards
  const [animatingOutId, setAnimatingOutId] = useState<string | null>(null);

  if (recommendations.length === 0) {
    return null;
  }

  // Filter out dismissed recruits
  const filteredRecommendations = dismissedIds 
    ? recommendations.filter(r => !dismissedIds.has(r.recruit.notionPageId))
    : recommendations;

  const topRecommendations = filteredRecommendations.slice(0, maxItems);

  if (topRecommendations.length === 0) {
    return null;
  }

  const handleContact = (recruit: Recruit) => {
    setContactRecruit(recruit);
  };

  const handleSchedule = (recruit: Recruit) => {
    setSchedulingRecruit(recruit);
    setScheduleOpen(true);
  };

  const handleDirectCall = (recruit: Recruit) => {
    setPostContactRecruit(recruit);
    setPostContactMethod('call');
    setPostContactOpen(true);
  };

  const handleDirectText = (recruit: Recruit) => {
    setPostContactRecruit(recruit);
    setPostContactMethod('text');
    setPostContactOpen(true);
  };

  // Handle contact method complete - only dismiss if connected
  const handleContactMethodComplete = (wasConnected: boolean) => {
    if (wasConnected && contactRecruit && onDismiss) {
      setAnimatingOutId(contactRecruit.notionPageId);
      const recruit = contactRecruit;
      setTimeout(() => {
        onDismiss(recruit, `Contact logged for ${recruit.name || 'recruit'}`);
        setAnimatingOutId(null);
        setContactRecruit(null);
      }, 300);
    } else {
      setContactRecruit(null);
    }
  };

  // Handle post-contact complete (direct call/text) - only dismiss if connected
  const handlePostContactComplete = (wasConnected: boolean) => {
    if (wasConnected && postContactRecruit && onDismiss) {
      // Connected - dismiss the card
      setAnimatingOutId(postContactRecruit.notionPageId);
      const recruit = postContactRecruit;
      setTimeout(() => {
        onDismiss(recruit, `Contact logged for ${recruit.name || 'recruit'}`);
        setAnimatingOutId(null);
        setPostContactRecruit(null);
        setPostContactOpen(false);
      }, 300);
    } else {
      // Not connected (no answer) - just close drawer, keep card visible
      setPostContactRecruit(null);
      setPostContactOpen(false);
    }
  };

  // Handle schedule complete - dismiss with animation
  const handleScheduleComplete = () => {
    if (schedulingRecruit && onDismiss) {
      setAnimatingOutId(schedulingRecruit.notionPageId);
      const recruit = schedulingRecruit;
      setTimeout(() => {
        onDismiss(recruit, `Follow-up scheduled for ${recruit.name || 'recruit'}`);
        setAnimatingOutId(null);
        setSchedulingRecruit(null);
        setScheduleOpen(false);
      }, 300);
    } else {
      setSchedulingRecruit(null);
      setScheduleOpen(false);
    }
  };

  // Count remaining beyond what's shown
  const remainingCount = filteredRecommendations.length - topRecommendations.length;

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">Recommended Today</h3>
          </div>
          {remainingCount > 0 && (
            <span className="text-xs text-muted-foreground">
              +{remainingCount} more
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Swipe right to contact, left to schedule
        </p>
        
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {topRecommendations.map((rec) => (
              <motion.div
                key={rec.recruit.notionPageId}
                layout
                initial={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ 
                  opacity: animatingOutId === rec.recruit.notionPageId ? 0 : 1,
                  height: animatingOutId === rec.recruit.notionPageId ? 0 : 'auto'
                }}
                transition={{ duration: 0.3 }}
              >
                <SwipeableRecommendationItem
                  recommendation={rec}
                  onRecruitClick={onRecruitClick}
                  onContact={handleContact}
                  onSchedule={handleSchedule}
                  onDirectCall={handleDirectCall}
                  onDirectText={handleDirectText}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Contact Method Drawer (Call/Text/In Person) */}
      <ContactMethodDrawer
        open={!!contactRecruit}
        onOpenChange={(open) => !open && setContactRecruit(null)}
        recruit={contactRecruit}
        onComplete={handleContactMethodComplete}
      />

      {/* Schedule Follow-up Drawer */}
      <ScheduleFollowUpDrawer
        open={scheduleOpen}
        onOpenChange={(open) => {
          setScheduleOpen(open);
          if (!open) setSchedulingRecruit(null);
        }}
        recruit={schedulingRecruit}
        onComplete={handleScheduleComplete}
      />

      {/* Post-Contact Drawer (for direct call/text flow) */}
      <PostContactDrawer
        open={postContactOpen}
        onOpenChange={(open) => {
          setPostContactOpen(open);
          if (!open) setPostContactRecruit(null);
        }}
        recruit={postContactRecruit}
        contactMethod={postContactMethod}
        onComplete={handlePostContactComplete}
      />
    </>
  );
};
