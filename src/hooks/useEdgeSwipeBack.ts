import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { hapticLight } from '@/utils/haptics';

interface UseEdgeSwipeBackOptions {
  onBack?: () => void;
  edgeWidth?: number; // How close to the left edge the swipe must start (px)
  threshold?: number; // How far to swipe before triggering back (px)
  enabled?: boolean;
}

interface SwipeState {
  isActive: boolean;
  startX: number;
  currentX: number;
  progress: number; // 0 to 1
}

export const useEdgeSwipeBack = ({
  onBack,
  edgeWidth = 20,
  threshold = 80,
  enabled = true,
}: UseEdgeSwipeBackOptions = {}) => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [swipeState, setSwipeState] = useState<SwipeState>({
    isActive: false,
    startX: 0,
    currentX: 0,
    progress: 0,
  });
  const hasTriggeredRef = useRef(false);

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  }, [onBack, navigate]);

  useEffect(() => {
    if (!enabled) return;
    
    const container = containerRef.current;
    if (!container) return;

    let startX = 0;
    let startY = 0;
    let isEdgeSwipe = false;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      
      // Only activate if touch starts within the edge zone
      isEdgeSwipe = startX <= edgeWidth;
      hasTriggeredRef.current = false;
      
      if (isEdgeSwipe) {
        setSwipeState({
          isActive: true,
          startX,
          currentX: startX,
          progress: 0,
        });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isEdgeSwipe) return;
      
      const touch = e.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      
      // If vertical movement is greater than horizontal, cancel the edge swipe
      if (Math.abs(deltaY) > Math.abs(deltaX) && deltaX < 30) {
        isEdgeSwipe = false;
        setSwipeState({ isActive: false, startX: 0, currentX: 0, progress: 0 });
        return;
      }
      
      // Only track rightward swipes
      if (deltaX > 0) {
        const progress = Math.min(deltaX / threshold, 1);
        setSwipeState({
          isActive: true,
          startX,
          currentX: touch.clientX,
          progress,
        });
        
        // Haptic feedback when crossing threshold
        if (progress >= 1 && !hasTriggeredRef.current) {
          hasTriggeredRef.current = true;
          hapticLight();
        }
      }
    };

    const handleTouchEnd = () => {
      if (!isEdgeSwipe) return;
      
      const deltaX = swipeState.currentX - swipeState.startX;
      
      if (deltaX >= threshold) {
        handleBack();
      }
      
      // Reset state
      isEdgeSwipe = false;
      setSwipeState({ isActive: false, startX: 0, currentX: 0, progress: 0 });
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, edgeWidth, threshold, handleBack, swipeState.currentX, swipeState.startX]);

  return {
    containerRef,
    swipeState,
    isSwipingBack: swipeState.isActive && swipeState.progress > 0,
  };
};
