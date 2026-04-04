import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { InsightsChat } from './InsightsChat';

export const AICoachFab = () => {
  const [isOpen, setIsOpen] = useState(false);
  const isVisible = useScrollDirection();

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className={`fixed right-4 z-40 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 transition-all duration-300 hover:scale-105 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
        }`}
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom) + 1.5rem)' }}
        size="icon"
      >
        <Sparkles className="h-6 w-6" />
      </Button>

      <InsightsChat isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};
