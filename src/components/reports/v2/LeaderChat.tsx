import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { ChatOverlay } from '@/components/shared/ChatOverlay';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/leader-insights-chat`;

const SUGGESTED_PROMPTS = [
  "What's the team's biggest funnel dropoff this week?",
  "Who's off pace for their goal?",
  "What time of day are we selling the most FP?",
  "Give me coaching priorities for today",
  "Who has days off planned next week?",
  "How's our group pacing this month vs last month?",
];

export const LeaderChatFab = () => {
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

      <ChatOverlay
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        chatUrl={CHAT_URL}
        title="Team AI Coach"
        placeholder="Ask about your group's numbers..."
        suggestedPrompts={SUGGESTED_PROMPTS}
        emptyStateTitle="Talk to Your Team's Data"
        emptyStateDescription="Ask anything about your group's performance — I've got everyone's numbers ready."
      />
    </>
  );
};
