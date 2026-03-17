import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useUnifiedPushNotifications } from "@/hooks/useUnifiedPushNotifications";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface NotificationRow {
  type: string;
  icon: string;
  title: string;
  description: string;
}

const MY_ACTIVITY: NotificationRow[] = [
  { type: 'save_reminder', icon: '⏰', title: 'Save Reminders', description: 'Reminded to save your work after sunset' },
  { type: 'start_your_day', icon: '☀️', title: 'Start Your Day', description: 'Noon nudge if you haven\'t started' },
  { type: 'personal_record', icon: '🏆', title: 'Personal Records', description: 'When you break a PR' },
  { type: 'task_reminder', icon: '📋', title: 'Task Reminders', description: 'Morning digest, past due, evening nudge' },
];

const MY_RECRUITS: NotificationRow[] = [
  { type: 'recruit_sale', icon: '🎉', title: 'Recruit Sale', description: 'When a direct recruit closes a deal' },
  { type: 'recruit_transition', icon: '🏠', title: 'Rookie Transition', description: 'When a rookie transitions into a home' },
  { type: 'onboarding_update', icon: '✅', title: 'Onboarding Updates', description: 'When recruits complete onboarding steps' },
  { type: 'access_request', icon: '👋', title: 'Access Requests', description: 'When someone requests app access' },
];

const SOCIAL: NotificationRow[] = [
  { type: 'comment_mention', icon: '💬', title: 'Comments & Mentions', description: 'When someone comments or @mentions you' },
  { type: 'reaction', icon: '🔥', title: 'Reactions', description: 'When someone reacts to your activity' },
  { type: 'watchlist_sale', icon: '👀', title: 'Watchlist Sales', description: 'When someone you\'re watching sells' },
];

const COMPETITIONS: NotificationRow[] = [
  { type: 'challenge_update', icon: '⚔️', title: 'Challenge Updates', description: 'Invites, progress, results' },
  { type: 'incentive_update', icon: '🎯', title: 'Incentive Updates', description: 'New incentives and completions' },
];

const LEADERSHIP: NotificationRow[] = [
  { type: 'leader_coaching', icon: '📊', title: 'Coaching Nudges', description: 'When a rep needs attention' },
  { type: 'blitz_rsvp', icon: '🗓️', title: 'Blitz RSVPs', description: 'Blitz attendance reminders' },
];

function NotificationToggleRow({
  row,
  enabled,
  disabled,
  onToggle,
}: {
  row: NotificationRow;
  enabled: boolean;
  disabled: boolean;
  onToggle: (type: string, enabled: boolean) => void;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between py-3 px-1 transition-opacity",
      disabled && "opacity-40 pointer-events-none"
    )}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-xl flex-shrink-0">{row.icon}</span>
        <div className="min-w-0">
          <Label className="text-sm font-medium leading-tight">{row.title}</Label>
          <p className="text-xs text-muted-foreground leading-tight mt-0.5">{row.description}</p>
        </div>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={(checked) => onToggle(row.type, checked)}
        disabled={disabled}
        className="flex-shrink-0 ml-3"
      />
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="pt-5 pb-1.5 px-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}

export function NotificationSettings() {
  const { toast } = useToast();
  const {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    isLoading: pushLoading,
  } = useUnifiedPushNotifications();
  
  const { isEnabled, togglePreference, isToggling } = useNotificationPreferences();
  const teamAccess = useTeamAccess();
  const isLeader = teamAccess.data?.accessLevel && teamAccess.data.accessLevel !== 'none';
  const [isSavingMaster, setIsSavingMaster] = useState(false);

  const masterEnabled = isSubscribed;
  const allDisabled = !masterEnabled;

  const handleMasterToggle = async (enabled: boolean) => {
    setIsSavingMaster(true);
    try {
      if (enabled) {
        const success = await subscribe();
        if (success) {
          toast({ title: "Notifications enabled", description: "You'll receive push notifications." });
        } else {
          toast({ title: "Could not enable", description: "Check your browser/device settings.", variant: "destructive" });
        }
      } else {
        const success = await unsubscribe();
        if (success) {
          toast({ title: "Notifications disabled", description: "All push notifications turned off." });
        }
      }
    } catch {
      toast({ title: "Error", description: "Failed to update.", variant: "destructive" });
    } finally {
      setIsSavingMaster(false);
    }
  };

  const handleToggle = (type: string, enabled: boolean) => {
    togglePreference({ type, enabled });
  };

  if (!isSupported) return null;

  if (permission === 'denied') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 px-1 py-2">
          <span className="text-xl">🔔</span>
          <div>
            <Label className="text-base font-semibold">Push Notifications</Label>
            <p className="text-sm text-muted-foreground">Blocked by your device. Enable in system settings.</p>
          </div>
        </div>
      </div>
    );
  }

  const renderSection = (label: string, rows: NotificationRow[]) => (
    <>
      <SectionHeader label={label} />
      <div className="divide-y divide-border/50">
        {rows.map((row) => (
          <NotificationToggleRow
            key={row.type}
            row={row}
            enabled={isEnabled(row.type)}
            disabled={allDisabled || isToggling}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </>
  );

  return (
    <div className="space-y-1">
      {/* Master Toggle */}
      <div className="flex items-center justify-between py-3 px-1">
        <div className="flex items-center gap-3">
          <span className="text-xl">🔔</span>
          <div>
            <Label className="text-base font-semibold">Push Notifications</Label>
            <p className="text-xs text-muted-foreground">
              {masterEnabled ? 'Receiving notifications' : 'All notifications off'}
            </p>
          </div>
        </div>
        <Switch
          checked={masterEnabled}
          onCheckedChange={handleMasterToggle}
          disabled={isSavingMaster || pushLoading}
        />
      </div>

      <AnimatePresence>
        {masterEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Separator className="my-1" />
            {renderSection('My Activity', MY_ACTIVITY)}
            <Separator className="my-1" />
            {renderSection('My Recruits', MY_RECRUITS)}
            <Separator className="my-1" />
            {renderSection('Social', SOCIAL)}
            <Separator className="my-1" />
            {renderSection('Competitions', COMPETITIONS)}
            {isLeader && (
              <>
                <Separator className="my-1" />
                {renderSection('Leadership', LEADERSHIP)}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
