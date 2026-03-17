import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const NOTIFICATION_TYPES = [
  {
    type: 'comment',
    label: '💬 Comment',
    description: 'Reply + View actions, deep link to comments',
  },
  {
    type: 'mention',
    label: '🔔 @Mention',
    description: 'Reply + View actions, deep link to comments',
  },
  {
    type: 'reaction',
    label: '🔥 Reaction',
    description: 'Reply + View actions, deep link to activity',
  },
  {
    type: 'task_assignment',
    label: '📋 Task Assignment',
    description: 'Add to Calendar + View Task actions',
  },
  {
    type: 'task_single_reminder',
    label: '⏰ Task Reminder',
    description: 'Call + Text native actions (tel:/sms:)',
  },
  {
    type: 'inactivity_save',
    label: '🌙 Inactivity Save',
    description: 'Save My Day + Still Working, requireInteraction',
  },
  {
    type: 'blitz_rsvp_first',
    label: '🔥 Blitz RSVP',
    description: "I'm In! + View Details, renotify",
  },
  {
    type: 'install_reminder_eve',
    label: '📅 Install Reminder',
    description: 'Text Customer + View Sale actions',
  },
  {
    type: 'access_request',
    label: '👋 Access Request',
    description: 'Meet Them + Got It actions',
  },
  {
    type: 'test_rich',
    label: '🧪 Generic Test',
    description: 'Basic test with Test Button + Dismiss',
  },
];

export default function DebugNotifications() {
  const navigate = useNavigate();
  const [sending, setSending] = useState<string | null>(null);

  const sendTest = async (type: string) => {
    setSending(type);
    try {
      const { data, error } = await supabase.functions.invoke('test-push-notification', {
        body: { targetEmail: 'calvinjschofield@gmail.com', type },
      });

      if (error) throw error;

      toast({
        title: data.success ? '✅ Sent!' : '❌ Failed',
        description: data.message || data.error,
        variant: data.success ? 'default' : 'destructive',
      });
    } catch (e: any) {
      toast({
        title: '❌ Error',
        description: e.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-muted-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-2xl font-bold text-foreground mb-1">🧪 Notification Tester</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Fire each notification type to test deep links, action buttons, and APNs delivery.
        </p>

        <div className="space-y-3">
          {NOTIFICATION_TYPES.map(({ type, label, description }) => (
            <div
              key={type}
              className="flex items-center justify-between p-4 rounded-xl border border-border bg-card"
            >
              <div className="flex-1 min-w-0 mr-3">
                <p className="font-semibold text-foreground text-sm">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <Button
                size="sm"
                onClick={() => sendTest(type)}
                disabled={sending !== null}
                className="shrink-0"
              >
                {sending === type ? '...' : 'Send'}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
