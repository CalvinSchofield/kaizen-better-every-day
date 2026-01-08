import React from 'react';
import { useEdgeSwipeBack } from '@/hooks/useEdgeSwipeBack';
import { cn } from '@/lib/utils';

interface EdgeSwipeContainerProps {
  children: React.ReactNode;
  onBack?: () => void;
  enabled?: boolean;
  className?: string;
}

export const EdgeSwipeContainer: React.FC<EdgeSwipeContainerProps> = ({
  children,
  onBack,
  enabled = true,
  className,
}) => {
  const { containerRef, swipeState, isSwipingBack } = useEdgeSwipeBack({
    onBack,
    enabled,
  });

  return (
    <div ref={containerRef} className={cn("relative min-h-screen", className)}>
      {/* Swipe indicator - shows on left edge during swipe */}
      {isSwipingBack && (
        <div
          className="fixed left-0 top-0 bottom-0 z-50 pointer-events-none flex items-center"
          style={{
            width: Math.max(swipeState.progress * 60, 20),
          }}
        >
          <div
            className="ml-2 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center transition-transform"
            style={{
              transform: `scale(${0.5 + swipeState.progress * 0.5})`,
              opacity: swipeState.progress,
            }}
          >
            <svg
              className="w-4 h-4 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{
                opacity: swipeState.progress >= 1 ? 1 : 0.5,
              }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </div>
        </div>
      )}
      
      {/* Page content with subtle shift during swipe */}
      <div
        style={{
          transform: isSwipingBack 
            ? `translateX(${swipeState.progress * 20}px)` 
            : 'none',
          transition: isSwipingBack ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
};
