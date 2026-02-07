import { useEffect, useRef } from 'react';

/**
 * Hook to handle iOS virtual keyboard viewport issues.
 * 
 * When the iOS keyboard opens, it changes the visualViewport height.
 * This hook monitors the viewport and adjusts layout to prevent
 * content from being pushed out of view or leaving large gaps.
 */
export function useKeyboardViewport() {
  const initialHeightRef = useRef<number | null>(null);
  const isKeyboardOpenRef = useRef(false);

  useEffect(() => {
    // Only run on iOS/mobile where this issue occurs
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    
    if (!isIOS || typeof window === 'undefined') return;

    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    // Capture the initial viewport height when keyboard is closed
    // This is more reliable than using window.innerHeight
    initialHeightRef.current = visualViewport.height;
    
    let rafId: number | null = null;
    let lastKeyboardHeight = 0;

    const handleResize = () => {
      // Cancel any pending RAF to avoid multiple updates
      if (rafId) cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        if (!initialHeightRef.current) {
          initialHeightRef.current = visualViewport.height;
        }

        const currentHeight = visualViewport.height;
        const windowHeight = window.innerHeight;
        
        // Calculate keyboard height using both viewport and window comparison
        // The keyboard height is the difference between window inner height and visual viewport height
        const keyboardFromViewport = windowHeight - currentHeight;
        
        // Also track if we've shrunk from our initial height (for cases where window.innerHeight also shrinks)
        const shrinkFromInitial = initialHeightRef.current - currentHeight;
        
        // Use the larger value - this handles different iOS behaviors
        const keyboardHeight = Math.max(keyboardFromViewport, shrinkFromInitial);
        
        // Keyboard is open if viewport got smaller by more than 100px
        const isKeyboardOpen = keyboardHeight > 100;
        
        if (isKeyboardOpen) {
          // Only update if keyboard height changed significantly (prevents jitter)
          if (Math.abs(keyboardHeight - lastKeyboardHeight) > 10 || !isKeyboardOpenRef.current) {
            lastKeyboardHeight = keyboardHeight;
            
            // Set CSS variable for keyboard height
            document.documentElement.style.setProperty(
              '--keyboard-height',
              `${keyboardHeight}px`
            );
            document.documentElement.classList.add('keyboard-open');
            isKeyboardOpenRef.current = true;
            
            // Prevent the page from scrolling behind the keyboard
            // This fixes the "blank space" issue by constraining the viewport
            document.documentElement.style.setProperty(
              '--visual-viewport-height',
              `${currentHeight}px`
            );
            
            // Ensure the focused element is visible
            const activeElement = document.activeElement;
            if (activeElement && (
              activeElement.tagName === 'INPUT' ||
              activeElement.tagName === 'TEXTAREA' ||
              activeElement.getAttribute('contenteditable') === 'true'
            )) {
              // Use a slightly longer delay to ensure the keyboard has finished animating
              setTimeout(() => {
                // Only scroll if the element is actually obscured
                const rect = activeElement.getBoundingClientRect();
                const viewportBottom = currentHeight;
                
                // If the input is below the visible viewport, scroll it into view
                if (rect.bottom > viewportBottom - 20) {
                  activeElement.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'nearest'
                  });
                }
              }, 100);
            }
          }
        } else {
          // Keyboard closed
          if (isKeyboardOpenRef.current) {
            document.documentElement.style.removeProperty('--keyboard-height');
            document.documentElement.style.removeProperty('--visual-viewport-height');
            document.documentElement.classList.remove('keyboard-open');
            isKeyboardOpenRef.current = false;
            lastKeyboardHeight = 0;
            
            // Reset initial height after keyboard closes (in case of orientation change)
            setTimeout(() => {
              if (!isKeyboardOpenRef.current) {
                initialHeightRef.current = visualViewport.height;
              }
            }, 300);
          }
        }
      });
    };

    // Update initial height on orientation change
    const handleOrientationChange = () => {
      // Wait for the orientation change to complete
      setTimeout(() => {
        if (!isKeyboardOpenRef.current) {
          initialHeightRef.current = visualViewport.height;
        }
      }, 500);
    };

    // Handle focus events to proactively prepare for keyboard
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Scroll the focused element into view before keyboard appears
        setTimeout(() => {
          target.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest'
          });
        }, 50);
      }
    };

    visualViewport.addEventListener('resize', handleResize);
    visualViewport.addEventListener('scroll', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    document.addEventListener('focusin', handleFocus);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      visualViewport.removeEventListener('resize', handleResize);
      visualViewport.removeEventListener('scroll', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      document.removeEventListener('focusin', handleFocus);
      document.documentElement.style.removeProperty('--keyboard-height');
      document.documentElement.style.removeProperty('--visual-viewport-height');
      document.documentElement.classList.remove('keyboard-open');
    };
  }, []);
}
