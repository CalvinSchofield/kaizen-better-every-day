import { Capacitor } from '@capacitor/core';

/**
 * Check if the app is running as a native Capacitor app
 */
export const isNativeApp = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Check if running on iOS (native or web)
 */
export const isIOS = (): boolean => {
  if (isNativeApp()) {
    return Capacitor.getPlatform() === 'ios';
  }
  // Fallback for web detection
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

/**
 * Check if running on Android (native or web)
 */
export const isAndroid = (): boolean => {
  if (isNativeApp()) {
    return Capacitor.getPlatform() === 'android';
  }
  // Fallback for web detection
  return /Android/.test(navigator.userAgent);
};

/**
 * Get current platform
 */
export const getPlatform = (): 'ios' | 'android' | 'web' => {
  if (isNativeApp()) {
    return Capacitor.getPlatform() as 'ios' | 'android';
  }
  return 'web';
};
