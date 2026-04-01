import { ChatOverlay } from '@/components/shared/ChatOverlay';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/insights-chat`;

const SUGGESTED_PROMPTS = [
  "How's my week looking vs last week?",
  "What day do I sell best on?",
  "Am I on pace for my goal?",
  "Where am I losing deals in my funnel?",
  "When do I sell the most during the day?",
  "Give me something to bring up in my 1-on-1",
];

interface InsightsChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InsightsChat = ({ isOpen, onClose }: InsightsChatProps) => {
  return (
    <ChatOverlay
      isOpen={isOpen}
      onClose={onClose}
      chatUrl={CHAT_URL}
      title="AI Coach"
      placeholder="Ask about your numbers..."
      suggestedPrompts={SUGGESTED_PROMPTS}
      emptyStateTitle="Talk to Your Data"
      emptyStateDescription="Ask anything about your performance — I've got all your numbers ready."
    />
  );
};
