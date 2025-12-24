import { useEffect } from "react";

/**
 * Detects if the app is running as an iOS PWA and applies safe area fallbacks
 * when env(safe-area-inset-top) is not returning the expected value.
 * 
 * This fixes issues on iOS beta versions where the safe area insets may not
 * be correctly reported to the browser.
 */
export function useSafeAreaFallback() {
  useEffect(() => {
    // Detect iOS standalone PWA mode
    const isStandalone = 
      (window.navigator as any).standalone === true || 
      window.matchMedia('(display-mode: standalone)').matches;
    
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isIOSPWA = isStandalone && isIOS;

    if (!isIOSPWA) {
      // Not an iOS PWA, no fallback needed
      return;
    }

    // Test if env(safe-area-inset-top) is returning 0 when it shouldn't
    const testEl = document.createElement('div');
    testEl.style.cssText = 'position:fixed;top:0;padding-top:env(safe-area-inset-top,0px);visibility:hidden;';
    document.body.appendChild(testEl);
    
    // Wait for layout to complete
    requestAnimationFrame(() => {
      const computedPadding = getComputedStyle(testEl).paddingTop;
      document.body.removeChild(testEl);
      
      // If env() returned 0px on an iOS PWA, we need a fallback
      if (computedPadding === '0px') {
        // Detect if this is a notch/Dynamic Island iPhone
        // Screen sizes for notch iPhones: 812+ logical height
        const screenHeight = window.screen.height;
        const hasNotch = screenHeight >= 812;
        
        // Set fallback values
        const topFallback = hasNotch ? '47px' : '20px';
        const bottomFallback = hasNotch ? '34px' : '0px';
        
        document.documentElement.style.setProperty('--safe-area-fallback-top', topFallback);
        document.documentElement.style.setProperty('--safe-area-fallback-bottom', bottomFallback);
        document.documentElement.classList.add('ios-pwa-fallback');
      }
    });
  }, []);
}
