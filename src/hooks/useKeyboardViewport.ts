import { useEffect } from 'react';

/**
 * Hook to handle iOS virtual keyboard viewport issues.
 * 
 * When the iOS keyboard opens, it changes the visualViewport height.
 * With our position:fixed layout on html/body, the browser sometimes
 * miscalculates the scroll position and pushes content too far up.
 * 
 * This hook listens to visualViewport resize events and adjusts a CSS
 * variable that can be used to offset content when the keyboard is open.
 */
export function useKeyboardViewport() {
  useEffect(() => {
    // Only run on iOS/mobile where this issue occurs
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!isIOS || typeof window === 'undefined') return;

    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    let initialHeight = visualViewport.height;
    let rafId: number | null = null;

    const handleResize = () => {
      // Cancel any pending RAF to avoid multiple updates
      if (rafId) cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        const currentHeight = visualViewport.height;
        const keyboardHeight = initialHeight - currentHeight;
        
        // If keyboard is open (viewport got smaller by more than 100px)
        if (keyboardHeight > 100) {
          // Set CSS variable for keyboard height
          document.documentElement.style.setProperty(
            '--keyboard-height',
            `${keyboardHeight}px`
          );
          document.documentElement.classList.add('keyboard-open');
          
          // Ensure the root scrolls to show focused element
          const activeElement = document.activeElement;
          if (activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.getAttribute('contenteditable') === 'true'
          )) {
            // Small delay to let the browser settle
            setTimeout(() => {
              activeElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'nearest'
              });
            }, 50);
          }
        } else {
          // Keyboard closed
          document.documentElement.style.removeProperty('--keyboard-height');
          document.documentElement.classList.remove('keyboard-open');
        }
      });
    };

    // Update initial height on orientation change
    const handleOrientationChange = () => {
      setTimeout(() => {
        initialHeight = visualViewport.height;
      }, 100);
    };

    visualViewport.addEventListener('resize', handleResize);
    visualViewport.addEventListener('scroll', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      visualViewport.removeEventListener('resize', handleResize);
      visualViewport.removeEventListener('scroll', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      document.documentElement.style.removeProperty('--keyboard-height');
      document.documentElement.classList.remove('keyboard-open');
    };
  }, []);
}
