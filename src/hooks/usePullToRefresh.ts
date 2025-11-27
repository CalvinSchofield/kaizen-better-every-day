import { useEffect, useRef, useState } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  isRefreshing?: boolean;
}

export const usePullToRefresh = ({ 
  onRefresh, 
  threshold = 80,
  isRefreshing = false 
}: UsePullToRefreshOptions) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let touchStartY = 0;
    let touchMoveY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger if at the top of the page
      if (container.scrollTop === 0) {
        touchStartY = e.touches[0].clientY;
        startY.current = touchStartY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startY.current === 0 || container.scrollTop > 0) return;

      touchMoveY = e.touches[0].clientY;
      const distance = touchMoveY - touchStartY;

      if (distance > 0 && distance < threshold * 2) {
        setIsPulling(true);
        setPullDistance(distance);
        // Prevent default scroll behavior while pulling
        if (distance > 10) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance >= threshold && !isRefreshing) {
        setIsPulling(false);
        setPullDistance(threshold);
        await onRefresh();
      }
      
      setIsPulling(false);
      setPullDistance(0);
      startY.current = 0;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, threshold, onRefresh, isRefreshing]);

  return {
    containerRef,
    pullDistance,
  };
};
