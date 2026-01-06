import { useRef, useCallback } from 'react';
import { hapticMedium, hapticSelection } from '@/utils/haptics';

interface UseLongPressOptions {
  delay?: number;
  onLongPress?: () => void;
  onTap?: () => void;
}

export const useLongPress = ({
  delay = 400,
  onLongPress,
  onTap,
}: UseLongPressOptions) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastTouchTimeRef = useRef(0);

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      isLongPressRef.current = false;

      // Store start position for movement detection
      if ('touches' in e) {
        startPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else {
        startPosRef.current = { x: e.clientX, y: e.clientY };
      }

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        hapticMedium();
        onLongPress?.();
      }, delay);
    },
    [delay, onLongPress]
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const end = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      cancel();

      if (!isLongPressRef.current) {
        // It was a tap, not a long press
        hapticSelection();
        onTap?.();
      }

      startPosRef.current = null;
    },
    [cancel, onTap]
  );

  const move = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!startPosRef.current) return;

      // If finger moved more than 10px, cancel long press detection
      let currentX: number, currentY: number;
      if ('touches' in e) {
        currentX = e.touches[0].clientX;
        currentY = e.touches[0].clientY;
      } else {
        currentX = e.clientX;
        currentY = e.clientY;
      }

      const dx = Math.abs(currentX - startPosRef.current.x);
      const dy = Math.abs(currentY - startPosRef.current.y);

      if (dx > 10 || dy > 10) {
        cancel();
      }
    },
    [cancel]
  );

  // On mobile, a single tap often fires both touch and mouse events.
  // Ignore mouse events that immediately follow a touch to prevent double-taps.
  const shouldIgnoreMouse = useCallback(() => {
    return Date.now() - lastTouchTimeRef.current < 750;
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      lastTouchTimeRef.current = Date.now();
      start(e);
    },
    [start]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      end(e);
    },
    [end]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      move(e);
    },
    [move]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (shouldIgnoreMouse()) return;
      start(e);
    },
    [shouldIgnoreMouse, start]
  );

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (shouldIgnoreMouse()) return;
      end(e);
    },
    [shouldIgnoreMouse, end]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (shouldIgnoreMouse()) return;
      move(e);
    },
    [shouldIgnoreMouse, move]
  );

  const onMouseLeave = useCallback(() => {
    if (shouldIgnoreMouse()) return;
    cancel();
  }, [shouldIgnoreMouse, cancel]);

  return {
    onTouchStart,
    onTouchEnd,
    onTouchMove,
    onMouseDown,
    onMouseUp,
    onMouseMove,
    onMouseLeave,
  };
};
