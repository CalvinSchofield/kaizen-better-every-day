import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { emitBadgeCelebration } from "@/components/badges/BadgeCelebrationOverlay";
import PendingApprovalScreen from "@/components/PendingApprovalScreen";

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

const BADGE_TESTS = [
  { emoji: '🔥', name: 'First Blood', description: 'Closed your first deal', rarity: 'common' as const },
  { emoji: '⚡', name: 'Lightning Closer', description: '3 closes in a single day', rarity: 'rare' as const },
  { emoji: '👑', name: 'King of the Hill', description: '#1 on the leaderboard for a full week', rarity: 'epic' as const },
  { emoji: '💎', name: 'Diamond Hands', description: '30-day sales streak without a miss', rarity: 'legendary' as const },
];

const STREAK_SCENARIOS = [
  { label: '🔥 Streak Continues (12 days)', streak: 12, closes: 2, protection: null, recovery: null },
  { label: '🛡️ Streak Protected', streak: 8, closes: 0, protection: { entry_date: 'today', method: 'effort' }, recovery: null },
  { label: '💀 Streak Broken + Recovery', streak: 0, closes: 0, protection: null, recovery: { status: 'active', target_fp: 3.0, target_prmr: 450, target_doors: 120, restored_streak: 15 } },
  { label: '🏆 Streak Restored!', streak: 15, closes: 1, protection: null, recovery: { status: 'recovered', restored_streak: 15 } },
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

  const fireBadgeCelebration = (badge: typeof BADGE_TESTS[number]) => {
    emitBadgeCelebration({
      id: `test-${badge.rarity}-${Date.now()}`,
      emoji: badge.emoji,
      name: badge.name,
      description: badge.description,
      rarity: badge.rarity,
    });
  };

  const fireAllBadges = () => {
    BADGE_TESTS.forEach((badge, i) => {
      setTimeout(() => fireBadgeCelebration(badge), i * 300);
    });
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

        {/* Badge Celebration Tests */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-foreground mb-1">🏅 Badge Celebration</h2>
          <p className="text-xs text-muted-foreground mb-3">Test the full-screen badge achievement overlay.</p>
          <div className="space-y-2">
            {BADGE_TESTS.map((badge) => (
              <div
                key={badge.rarity}
                className="flex items-center justify-between p-3 rounded-xl border border-border bg-card"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xl">{badge.emoji}</span>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{badge.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{badge.rarity}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => fireBadgeCelebration(badge)}>
                  Test
                </Button>
              </div>
            ))}
            <Button className="w-full mt-2" variant="secondary" onClick={fireAllBadges}>
              🎉 Fire All (Queued)
            </Button>
          </div>
        </div>

        {/* Streak Outcome Preview */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-foreground mb-1">🔥 Streak Outcomes</h2>
          <p className="text-xs text-muted-foreground mb-3">Preview all streak card states inline.</p>
          <div className="space-y-3">
            {STREAK_SCENARIOS.map((scenario, i) => (
              <div key={i}>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">{scenario.label}</p>
                <StreakPreview {...scenario} />
              </div>
            ))}
          </div>
        </div>

        {/* Push Notification Tests */}
        <h2 className="text-lg font-bold text-foreground mb-3">📲 Push Notifications</h2>
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

/* Inline streak preview component — renders static mock data so we don't need real hooks */
function StreakPreview({ streak, closes, protection, recovery }: {
  streak: number;
  closes: number;
  protection: { entry_date: string; method: string } | null;
  recovery: { status: string; target_fp?: number; target_prmr?: number; target_doors?: number; restored_streak?: number } | null;
}) {
  // Recovery restored
  if (recovery?.status === "recovered") {
    return (
      <div className="rounded-2xl border border-green-500/20 bg-green-500/8 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-base">🔥</span>
          <span className="text-sm font-bold text-foreground">Streak Restored!</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 ml-[3.25rem]">
          Incredible effort. Your {streak || recovery.restored_streak}-day streak lives on.
        </p>
      </div>
    );
  }

  // Sale made, streak continues
  if (closes >= 1 && streak > 0) {
    return (
      <div className="rounded-2xl border border-orange-500/15 bg-orange-500/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🔥</span>
          <span className="text-sm font-semibold text-foreground">
            {streak}-Day Streak — another one in the books
          </span>
        </div>
      </div>
    );
  }

  // Protection earned
  if (closes === 0 && protection) {
    return (
      <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">🛡️ Streak Protected</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Your effort today earned you a shield. Day {streak} continues.
        </p>
      </div>
    );
  }

  // Streak broken with recovery targets
  if (recovery?.status === "active") {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3.5 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            Your {recovery.restored_streak}-day streak has ended
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Put in exceptional work over the next 2 knocking days to earn it back:
        </p>
        <div className="flex gap-3 pt-0.5">
          {(recovery.target_fp ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-foreground">{recovery.target_fp!.toFixed(1)}</span>
              <span className="text-muted-foreground">FP+</span>
            </div>
          )}
          {(recovery.target_prmr ?? 0) > 0 && (
            <>
              <span className="text-muted-foreground/40 text-xs">or</span>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-foreground">${Math.round(recovery.target_prmr!)}</span>
                <span className="text-muted-foreground">PRMR</span>
              </div>
            </>
          )}
          {(recovery.target_doors ?? 0) > 0 && (
            <>
              <span className="text-muted-foreground/40 text-xs">or</span>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-foreground">{recovery.target_doors}</span>
                <span className="text-muted-foreground">doors</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return <p className="text-xs text-muted-foreground italic">No streak state to show</p>;
}
