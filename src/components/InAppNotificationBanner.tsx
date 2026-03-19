import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  url?: string;
  type?: string;
  recruitId?: string;
  activityId?: string;
}

// Global event bus for foreground notifications
type NotificationListener = (notification: InAppNotification) => void;
const listeners = new Set<NotificationListener>();

export function emitInAppNotification(notification: InAppNotification) {
  listeners.forEach(fn => fn(notification));
}

const AUTO_DISMISS_MS = 6000;

export function InAppNotificationBanner() {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const navigate = useNavigate();
  const touchStartY = useRef<number>(0);
  const touchDelta = useRef<number>(0);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler: NotificationListener = (notification) => {
      setNotifications(prev => [notification, ...prev].slice(0, 3));

      // Auto-dismiss after timeout
      setTimeout(() => {
        dismiss(notification.id);
      }, AUTO_DISMISS_MS);
    };

    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissing(id);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
      setDismissing(null);
    }, 300);
  }, []);

  const handleTap = useCallback((notification: InAppNotification) => {
    if (notification.url) {
      navigate(notification.url);
    }
    dismiss(notification.id);
  }, [navigate, dismiss]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchDelta.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchDelta.current = e.touches[0].clientY - touchStartY.current;
  }, []);

  const handleTouchEnd = useCallback((id: string) => {
    // Swipe up to dismiss
    if (touchDelta.current < -30) {
      dismiss(id);
    }
  }, [dismiss]);

  if (notifications.length === 0) return null;

  return (
    <div 
      className="fixed left-0 right-0 z-[200] flex flex-col items-center gap-2 px-3 pointer-events-none"
      style={{ top: 'calc(var(--effective-safe-area-top, 0px) + 0.5rem)' }}
    >
      {notifications.map((notification) => (
        <div
          key={notification.id}
          ref={bannerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => handleTouchEnd(notification.id)}
          onClick={() => handleTap(notification)}
          className={cn(
            'pointer-events-auto w-full max-w-md rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-lg',
            'px-4 py-3 cursor-pointer transition-all duration-300',
            'active:scale-[0.98]',
            dismissing === notification.id
              ? '-translate-y-full opacity-0'
              : 'translate-y-0 opacity-100 animate-in slide-in-from-top-5'
          )}
        >
          <div className="flex items-start gap-3">
            {/* Icon based on type */}
            <div className="shrink-0 mt-0.5 text-lg">
              {getNotificationIcon(notification.type)}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm leading-tight">
                {notification.title}
              </p>
              <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">
                {notification.body}
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                dismiss(notification.id);
              }}
              className="shrink-0 p-1 text-muted-foreground hover:text-foreground rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Swipe hint */}
          <div className="flex justify-center mt-1.5">
            <div className="w-8 h-0.5 rounded-full bg-muted-foreground/20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function getNotificationIcon(type?: string): string {
  switch (type) {
    case 'comment': return '💬';
    case 'mention': return '🔔';
    case 'reaction': return '🔥';
    case 'task_assignment': return '📋';
    case 'task_single_reminder': return '⏰';
    case 'inactivity_save': return '🌙';
    case 'blitz_rsvp_first': return '🔥';
    case 'install_reminder_eve': return '📅';
    case 'install_reminder_morning': return '📦';
    case 'install_reminder_due': return '📦';
    case 'access_request': return '👋';
    default: return '🔔';
  }
}
