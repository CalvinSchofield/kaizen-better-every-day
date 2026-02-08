import { motion } from "framer-motion";
import { Trophy, Target, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyActiveChallenges } from "@/hooks/useChallenges";
import { useMyActiveIncentives } from "@/hooks/useIncentives";
import { useNavigate } from "react-router-dom";
import { hapticLight } from "@/utils/haptics";
import { differenceInHours, differenceInDays, parseISO } from "date-fns";

interface CompetitionsCardProps {
  className?: string;
}

const getTimeRemaining = (endDate: string): string => {
  const end = parseISO(endDate);
  const now = new Date();
  const hours = differenceInHours(end, now);
  const days = differenceInDays(end, now);

  if (hours < 0) return 'Ended';
  if (hours < 24) return `${hours}h left`;
  return `${days}d left`;
};

export const CompetitionsCard = ({ className }: CompetitionsCardProps) => {
  const { data: challenges = [] } = useMyActiveChallenges();
  const { data: incentives = [] } = useMyActiveIncentives();
  const navigate = useNavigate();

  // Filter to only active competitions
  const activeCompetitions = [
    ...challenges.filter(c => c.status === 'active').map(c => ({
      id: c.id,
      type: 'challenge' as const,
      title: c.participants.map(p => p.rep_name?.split(' ')[0] || 'Opponent').join(' vs '),
      metric: c.metric,
      endDate: c.end_date,
      stakes: c.stakes,
    })),
    ...incentives.filter(i => i.status === 'active').map(i => ({
      id: i.id,
      type: 'incentive' as const,
      title: i.title,
      metric: i.metric,
      endDate: i.end_date,
      reward: i.reward,
    })),
  ].slice(0, 2); // Show max 2

  if (activeCompetitions.length === 0) return null;

  const handleClick = () => {
    hapticLight();
    navigate('/compete');
  };

  return (
    <motion.div
      className={cn(
        "p-4 rounded-xl border bg-muted/30 border-border/30",
        "cursor-pointer active:scale-[0.98] transition-transform",
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      onClick={handleClick}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="font-semibold text-foreground">Active Competitions</span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        {activeCompetitions.map((comp) => (
          <div
            key={comp.id}
            className="flex items-center justify-between p-2 rounded-lg bg-background/50"
          >
            <div className="flex items-center gap-2">
              {comp.type === 'challenge' ? (
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs">⚔️</span>
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Target className="w-3 h-3 text-amber-500" />
                </div>
              )}
              <div>
                <div className="text-sm font-medium truncate max-w-[140px]">
                  {comp.title}
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {comp.metric.replace('_', ' ')}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{getTimeRemaining(comp.endDate)}</span>
            </div>
          </div>
        ))}
      </div>

      {activeCompetitions.length === 2 && (
        <div className="mt-2 text-xs text-center text-primary">
          Tap to see all competitions →
        </div>
      )}
    </motion.div>
  );
};
