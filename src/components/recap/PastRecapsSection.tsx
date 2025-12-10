import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Play, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRecapData } from '@/hooks/useRecapData';
import { RecapStory } from './RecapStory';
import { format } from 'date-fns';

export function PastRecapsSection() {
  const [showStory, setShowStory] = useState(false);
  const [activeRecap, setActiveRecap] = useState<'week' | 'month' | null>(null);
  
  const { data: weekStats } = useRecapData('week');
  const { data: monthStats } = useRecapData('month');

  if (!weekStats && !monthStats) {
    return null;
  }

  const handleOpenRecap = (type: 'week' | 'month') => {
    setActiveRecap(type);
    setShowStory(true);
  };

  return (
    <>
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Recaps
        </h3>
        
        <div className="flex gap-2 flex-wrap">
          {weekStats && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenRecap('week')}
              className="gap-2"
            >
              <Play className="w-3 h-3" />
              {weekStats.periodLabel}
            </Button>
          )}
          
          {monthStats && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenRecap('month')}
              className="gap-2"
            >
              <Play className="w-3 h-3" />
              {format(monthStats.dateRange.start, 'MMMM')}
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showStory && activeRecap && (
          <RecapStory
            stats={activeRecap === 'week' ? weekStats! : monthStats!}
            onClose={() => setShowStory(false)}
            onComplete={() => {}}
          />
        )}
      </AnimatePresence>
    </>
  );
}
