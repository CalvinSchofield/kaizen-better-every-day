import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Detects if the app is running as an iOS PWA and applies safe area fallbacks
 * when env(safe-area-inset-top) is not returning the expected value.
 * 
 * This fixes issues on iOS beta versions where the safe area insets may not
 * be correctly reported to the browser.
 */
export function useSafeAreaFallback() {
  useEffect(() => {
    const root = document.documentElement;
    const isNativeIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

    const resetFallbacks = () => {
      root.style.removeProperty('--safe-area-fallback-top');
      root.style.removeProperty('--safe-area-fallback-bottom');
      root.classList.remove('ios-pwa-fallback');
    };

    const measureInset = (edge: 'top' | 'bottom') => {
      const probe = document.createElement('div');
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      probe.style.pointerEvents = 'none';
      probe.style[edge === 'top' ? 'paddingTop' : 'paddingBottom'] = `env(safe-area-inset-${edge}, 0px)`;
      document.body.appendChild(probe);
      const styles = window.getComputedStyle(probe);
      const value = parseFloat(edge === 'top' ? styles.paddingTop : styles.paddingBottom) || 0;
      probe.remove();
      return value;
    };

    const getFallbackInsets = () => {
      const longestSide = Math.max(window.screen.width, window.screen.height);
      const isIPhone = /iPhone/.test(navigator.userAgent);

      if (isIPhone) {
        if (longestSide >= 852) {
          return { top: 59, bottom: 34 };
        }

        if (longestSide >= 812) {
          return { top: 47, bottom: 34 };
        }

        return { top: 20, bottom: 0 };
      }

      return { top: 24, bottom: 20 };
    };

    const applyFallbacks = () => {
      resetFallbacks();

      if (!isNativeIOS) return;

      const measuredTop = measureInset('top');
      const measuredBottom = measureInset('bottom');

      if (measuredTop > 0 && measuredBottom > 0) return;

      const fallback = getFallbackInsets();

      if (measuredTop <= 0) {
        root.style.setProperty('--safe-area-fallback-top', `${fallback.top}px`);
      }

      if (measuredBottom <= 0) {
        root.style.setProperty('--safe-area-fallback-bottom', `${fallback.bottom}px`);
      }

      root.classList.add('ios-pwa-fallback');
    };

    applyFallbacks();

    window.addEventListener('resize', applyFallbacks);
    document.addEventListener('visibilitychange', applyFallbacks);

    return () => {
      window.removeEventListener('resize', applyFallbacks);
      document.removeEventListener('visibilitychange', applyFallbacks);
      resetFallbacks();
    };
  }, []);
}
