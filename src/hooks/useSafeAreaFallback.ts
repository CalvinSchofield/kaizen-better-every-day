import { useEffect } from "react";

/**
 * Detects if the app is running as an iOS PWA and applies safe area fallbacks
 * when env(safe-area-inset-top) is not returning the expected value.
 * 
 * This fixes issues on iOS beta versions where the safe area insets may not
 * be correctly reported to the browser.
 */
export function useSafeAreaFallback() {
  // Disabled - the native env(safe-area-inset-*) values work correctly
  // This was causing issues with extra spacing at the top
  useEffect(() => {
    // Clean up any previously applied fallbacks
    document.documentElement.style.removeProperty('--safe-area-fallback-top');
    document.documentElement.style.removeProperty('--safe-area-fallback-bottom');
    document.documentElement.classList.remove('ios-pwa-fallback');
  }, []);
}
