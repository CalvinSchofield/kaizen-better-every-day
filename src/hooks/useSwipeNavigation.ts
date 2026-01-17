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
  const touchStartY = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  const [swipeState, setSwipeState] = useState<SwipeState>({
    isSwiping: false,
    direction: null,
    offset: 0,
  });

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchEndX.current = null;
    isHorizontalSwipe.current = null;
    setSwipeState({ isSwiping: false, direction: null, offset: 0 });
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = touchStartX.current - currentX;
    const diffY = touchStartY.current - currentY;
    const absDiffX = Math.abs(diffX);
    const absDiffY = Math.abs(diffY);
    
    // Lock direction once we've moved enough (10px threshold)
    if (isHorizontalSwipe.current === null && (absDiffX > 10 || absDiffY > 10)) {
      isHorizontalSwipe.current = absDiffX > absDiffY;
    }
    
    // If horizontal swipe detected, prevent scroll and track movement
    if (isHorizontalSwipe.current === true) {
      // Prevent vertical scrolling during horizontal swipe
      e.preventDefault();
      
      touchEndX.current = currentX;
      
      if (absDiffX > 10) {
        setSwipeState({
          isSwiping: true,
          direction: diffX > 0 ? 'left' : 'right',
          offset: Math.min(absDiffX, 100), // Cap the visual offset
        });
      }
    }
    // If vertical scroll detected, don't interfere
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchStartX.current === null || touchEndX.current === null || !isHorizontalSwipe.current) {
      setSwipeState({ isSwiping: false, direction: null, offset: 0 });
      touchStartX.current = null;
      touchStartY.current = null;
      isHorizontalSwipe.current = null;
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
    touchStartY.current = null;
    touchEndX.current = null;
    isHorizontalSwipe.current = null;
    setSwipeState({ isSwiping: false, direction: null, offset: 0 });
  }, [onSwipeLeft, onSwipeRight, threshold]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    swipeState,
  };
};
