import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';

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
const SWIPE_THRESHOLD = 80;

export function InAppNotificationBanner() {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const handler: NotificationListener = (notification) => {
      setNotifications(prev => [notification, ...prev].slice(0, 3));
      setTimeout(() => {
        dismiss(notification.id);
      }, AUTO_DISMISS_MS);
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleTap = useCallback((notification: InAppNotification) => {
    if (notification.url) {
      navigate(notification.url);
    }
    dismiss(notification.id);
  }, [navigate, dismiss]);

  if (notifications.length === 0) return null;

  return (
    <div 
      className="fixed left-0 right-0 z-[200] flex flex-col items-center gap-2 px-3 pointer-events-none"
      style={{ top: 'calc(var(--effective-safe-area-top, 59px) + 0.5rem)' }}
    >
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <SwipeableNotification
            key={notification.id}
            notification={notification}
            onTap={handleTap}
            onDismiss={dismiss}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function SwipeableNotification({
  notification,
  onTap,
  onDismiss,
}: {
  notification: InAppNotification;
  onTap: (n: InAppNotification) => void;
  onDismiss: (id: string) => void;
}) {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-SWIPE_THRESHOLD * 2, 0, SWIPE_THRESHOLD * 2], [0, 1, 0]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) > SWIPE_THRESHOLD) {
      onDismiss(notification.id);
    }
  };

  return (
    <motion.div
      layout
      initial={{ y: -60, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={handleDragEnd}
      style={{ x, opacity }}
      onClick={() => onTap(notification)}
      className={cn(
        'pointer-events-auto w-full max-w-md rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-lg',
        'px-4 py-3 cursor-pointer',
        'active:scale-[0.98]',
      )}
    >
      <div className="flex items-start gap-3">
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
      </div>

      {/* Swipe hint bar */}
      <div className="flex justify-center mt-1.5">
        <div className="w-8 h-0.5 rounded-full bg-muted-foreground/20" />
      </div>
    </motion.div>
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
    case 'access_request': return '👋';
    default: return '🔔';
  }
}