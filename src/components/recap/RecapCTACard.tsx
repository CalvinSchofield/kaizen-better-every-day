import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Play } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useRecapData } from '@/hooks/useRecapData';
import { useRecapState } from '@/hooks/useRecapState';
import { RecapStory } from './RecapStory';

export function RecapCTACard() {
  const [showStory, setShowStory] = useState(false);
  const [activeRecap, setActiveRecap] = useState<'week' | 'month' | null>(null);
  
  const recapState = useRecapState();
  const { data: weekStats } = useRecapData('week');
  const { data: monthStats } = useRecapData('month');

  const showWeekRecap = recapState.weekRecapAvailable && !recapState.weekRecapViewed && weekStats;
  const showMonthRecap = recapState.monthRecapAvailable && !recapState.monthRecapViewed && monthStats;

  const handleOpenRecap = (type: 'week' | 'month') => {
    setActiveRecap(type);
    setShowStory(true);
  };

  const handleComplete = () => {
    if (activeRecap === 'week') {
      recapState.markWeekViewed();
    } else if (activeRecap === 'month') {
      recapState.markMonthViewed();
    }
  };

  if (!showWeekRecap && !showMonthRecap) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {showWeekRecap && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card 
              className="relative overflow-hidden bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20 cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => handleOpenRecap('week')}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent" />
              <div className="relative p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Your Week in Review</h3>
                    <p className="text-sm text-muted-foreground">See your highlights</p>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                  <Play className="w-5 h-5 text-primary-foreground ml-0.5" />
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMonthRecap && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card 
              className="relative overflow-hidden bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-background border-purple-500/20 cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => handleOpenRecap('month')}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-transparent" />
              <div className="relative p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Your Month in Review</h3>
                    <p className="text-sm text-muted-foreground">See your highlights</p>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center">
                  <Play className="w-5 h-5 text-white ml-0.5" />
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showStory && activeRecap && (
          <RecapStory
            stats={activeRecap === 'week' ? weekStats! : monthStats!}
            onClose={() => setShowStory(false)}
            onComplete={handleComplete}
          />
        )}
      </AnimatePresence>
    </>
  );
}
