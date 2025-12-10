import { useRef, useCallback, useState, TouchEvent } from "react";

interface UseSwipeNavigationOptions {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  threshold?: number;
}

interface SwipeState {
  isSwiping: boolean;
  direction: 'left' | 'right' | null;
  offset: number;
}

export const useSwipeNavigation = ({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
}: UseSwipeNavigationOptions) => {
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const [swipeState, setSwipeState] = useState<SwipeState>({
    isSwiping: false,
    direction: null,
    offset: 0,
  });

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
    setSwipeState({ isSwiping: false, direction: null, offset: 0 });
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (touchStartX.current === null) return;
    
    touchEndX.current = e.touches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    const absDiff = Math.abs(diff);
    
    // Only show visual feedback after a small movement threshold
    if (absDiff > 10) {
      setSwipeState({
        isSwiping: true,
        direction: diff > 0 ? 'left' : 'right',
        offset: Math.min(absDiff, 100), // Cap the visual offset
      });
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchStartX.current === null || touchEndX.current === null) {
      setSwipeState({ isSwiping: false, direction: null, offset: 0 });
      return;
    }
    
    const diff = touchStartX.current - touchEndX.current;
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        // Swiped left - go forward (next period)
        onSwipeLeft();
      } else {
        // Swiped right - go back (previous period)
        onSwipeRight();
      }
    }
    
    touchStartX.current = null;
    touchEndX.current = null;
    setSwipeState({ isSwiping: false, direction: null, offset: 0 });
  }, [onSwipeLeft, onSwipeRight, threshold]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    swipeState,
  };
};
