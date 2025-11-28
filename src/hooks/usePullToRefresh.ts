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
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isAtTop = () => {
      // Check both container scroll and window scroll for PWA compatibility
      return container.scrollTop === 0 && window.scrollY === 0;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isAtTop() && !isRefreshing) {
        startY.current = e.touches[0].clientY;
        isDragging.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || isRefreshing) return;
      
      currentY.current = e.touches[0].clientY;
      const distance = currentY.current - startY.current;

      // Only allow pulling down (positive distance) when at top
      if (distance > 0 && isAtTop()) {
        // Dampen the pull distance for a more natural feel
        const dampenedDistance = Math.min(distance * 0.5, threshold * 1.5);
        setPullDistance(dampenedDistance);
        
        // Prevent default scroll behavior while pulling
        if (distance > 10) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!isDragging.current) return;
      
      if (pullDistance >= threshold && !isRefreshing) {
        await onRefresh();
      }
      
      // Reset states
      isDragging.current = false;
      setPullDistance(0);
      startY.current = 0;
      currentY.current = 0;
    };

    // Use capture phase and non-passive for touchmove to allow preventDefault
    container.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true, capture: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart, true);
      container.removeEventListener('touchmove', handleTouchMove, true);
      container.removeEventListener('touchend', handleTouchEnd, true);
    };
  }, [pullDistance, threshold, onRefresh, isRefreshing]);

  return {
    containerRef,
    pullDistance,
  };
};
