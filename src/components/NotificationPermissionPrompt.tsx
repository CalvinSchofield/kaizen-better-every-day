import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';

const DISMISSED_KEY = 'notification-prompt-dismissed';
const PROMPT_DELAY_MS = 30000; // Show after 30 seconds of activity

interface NotificationPermissionPromptProps {
  hasStartedTracking?: boolean;
}

export function NotificationPermissionPrompt({ hasStartedTracking = false }: NotificationPermissionPromptProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const { isSupported, isSubscribed, permission, subscribe, isLoading } = usePushNotifications();

  useEffect(() => {
    // Check if user has already dismissed or subscribed
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

    // Don't show if already subscribed or not supported
    if (isSubscribed || !isSupported || permission === 'denied') {
      return;
    }

    // Show prompt after delay once user has started tracking
    if (hasStartedTracking) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, PROMPT_DELAY_MS);

      return () => clearTimeout(timer);
    }
  }, [hasStartedTracking, isSubscribed, isSupported, permission]);

  const handleEnable = async () => {
    const success = await subscribe();
    if (success) {
      toast.success('Notifications enabled! We\'ll remind you to save your work.');
      setShowPrompt(false);
    } else {
      toast.error('Could not enable notifications. Check your browser settings.');
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setIsDismissed(true);
    setShowPrompt(false);
  };

  const handleNotNow = () => {
    setShowPrompt(false);
    // Will show again next session
  };

  if (isLoading || isDismissed || isSubscribed || !showPrompt || !isSupported) {
    return null;
  }

  return (
    <Card className="mb-4 border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm">Never forget to save</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Get reminded to save your work after sunset if you've been idle.
            </p>
            <div className="flex gap-2 mt-3">
              <Button 
                size="sm" 
                onClick={handleEnable}
                className="text-xs h-8"
              >
                Enable Reminders
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleNotNow}
                className="text-xs h-8"
              >
                Not Now
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss forever</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
