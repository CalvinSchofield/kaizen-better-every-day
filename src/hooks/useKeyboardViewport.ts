import { useEffect, useRef } from 'react';

/**
 * Hook to handle iOS virtual keyboard viewport issues.
 *
 * Sets the --keyboard-height CSS variable so UI elements (e.g. bottom nav)
 * can react to the keyboard. Does NOT force layout height or call
 * scrollIntoView — WKWebView handles that natively.
 */
export function useKeyboardViewport() {
  const initialHeightRef = useRef<number | null>(null);
  const isKeyboardOpenRef = useRef(false);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!isIOS || typeof window === 'undefined') return;

    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    initialHeightRef.current = visualViewport.height;

    let rafId: number | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const handleResize = () => {
      if (rafId) cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        if (!initialHeightRef.current) {
          initialHeightRef.current = visualViewport.height;
        }

        const currentHeight = visualViewport.height;
        const windowHeight = window.innerHeight;

        const keyboardFromViewport = windowHeight - currentHeight;
        const shrinkFromInitial = initialHeightRef.current - currentHeight;
        const keyboardHeight = Math.max(keyboardFromViewport, shrinkFromInitial);

        const isKeyboardOpen = keyboardHeight > 100;

        if (isKeyboardOpen) {
          // Wait for keyboard animation to settle before applying
          if (settleTimer) clearTimeout(settleTimer);
          settleTimer = setTimeout(() => {
            document.documentElement.style.setProperty(
              '--keyboard-height',
              `${keyboardHeight}px`
            );
            document.documentElement.classList.add('keyboard-open');
            isKeyboardOpenRef.current = true;
          }, 300);
        } else {
          if (settleTimer) clearTimeout(settleTimer);
          if (isKeyboardOpenRef.current) {
            document.documentElement.style.removeProperty('--keyboard-height');
            document.documentElement.classList.remove('keyboard-open');
            isKeyboardOpenRef.current = false;

            // Reset initial height after keyboard closes
            setTimeout(() => {
              if (!isKeyboardOpenRef.current) {
                initialHeightRef.current = visualViewport.height;
              }
            }, 300);
          }
        }
      });
    };

    const handleOrientationChange = () => {
      setTimeout(() => {
        if (!isKeyboardOpenRef.current) {
          initialHeightRef.current = visualViewport.height;
        }
      }, 500);
    };

    visualViewport.addEventListener('resize', handleResize);
    visualViewport.addEventListener('scroll', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (settleTimer) clearTimeout(settleTimer);
      visualViewport.removeEventListener('resize', handleResize);
      visualViewport.removeEventListener('scroll', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      document.documentElement.style.removeProperty('--keyboard-height');
      document.documentElement.classList.remove('keyboard-open');
    };
  }, []);
}
