import { useState } from "react";
import { motion, Easing } from "framer-motion";
import { Rocket, Sun, Moon, CloudSun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DailyMissionCard } from "./DailyMissionCard";
import { SeasonGoalsPreview } from "./SeasonGoalsPreview";
import { CompetitionsPreview } from "./CompetitionsPreview";
import { hapticMedium } from "@/utils/haptics";
import { getCleanFirstName } from "@/utils/nameUtils";
import { format } from "date-fns";

interface PreWorkingStateProps {
  repName?: string;
  onStartDay: () => void;
  isStarting?: boolean;
}

// Get time-appropriate greeting
const getGreeting = (): { text: string; icon: React.ReactNode } => {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return { text: "Good morning", icon: <Sun className="h-5 w-5 text-amber-500" /> };
  } else if (hour >= 12 && hour < 17) {
    return { text: "Good afternoon", icon: <CloudSun className="h-5 w-5 text-orange-500" /> };
  } else if (hour >= 17 && hour < 21) {
    return { text: "Good evening", icon: <Moon className="h-5 w-5 text-indigo-400" /> };
  } else {
    return { text: "Hey there", icon: <Moon className="h-5 w-5 text-indigo-400" /> };
  }
};

const easeOut: Easing = [0.25, 0.1, 0.25, 1];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: easeOut,
    },
  },
};

export const PreWorkingState = ({ 
  repName, 
  onStartDay, 
  isStarting = false 
}: PreWorkingStateProps) => {
  const [starting, setStarting] = useState(false);
  
  const greeting = getGreeting();
  const firstName = repName ? getCleanFirstName(repName) : '';
  const todayFormatted = format(new Date(), 'EEEE, MMMM d');

  const handleStartDay = async () => {
    if (starting || isStarting) return;
    
    setStarting(true);
    hapticMedium();
    
    try {
      await onStartDay();
    } finally {
      // Keep button in loading state until parent unmounts this component
      // This prevents flash of "Start" button before counter grid appears
    }
  };

  const isButtonLoading = starting || isStarting;

  return (
    <motion.div 
      className="flex flex-col h-full overflow-y-auto pb-24"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header greeting */}
      <motion.div 
        className="px-4 pt-6 pb-4"
        variants={itemVariants}
      >
        <div className="flex items-center gap-2 mb-1">
          {greeting.icon}
          <h1 className="text-xl font-bold text-foreground">
            {greeting.text}{firstName ? `, ${firstName}` : ''}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">{todayFormatted}</p>
      </motion.div>

      {/* Mission cards */}
      <div className="flex-1 px-4 space-y-4">
        <motion.div variants={itemVariants}>
          <DailyMissionCard />
        </motion.div>

        <motion.div variants={itemVariants}>
          <SeasonGoalsPreview />
        </motion.div>

        <motion.div variants={itemVariants}>
          <CompetitionsPreview />
        </motion.div>
      </div>

      {/* Start Day CTA - Fixed at bottom */}
      <motion.div 
        className="sticky bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-8"
        variants={itemVariants}
      >
        <Button
          onClick={handleStartDay}
          disabled={isButtonLoading}
          size="lg"
          className="w-full h-14 text-lg font-semibold active:scale-[0.97] transition-transform"
        >
          {isButtonLoading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
              Starting...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Start My Day
            </span>
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
};
