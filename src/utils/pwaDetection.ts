/**
 * Detects if the app is running in PWA (installed) mode
 */
export const isPWAInstalled = (): boolean => {
  // Check display-mode media query
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  // Check iOS standalone mode
  const isIOSStandalone = (window.navigator as any).standalone === true;
  
  return isStandalone || isIOSStandalone;
};

/**
 * Checks if user should bypass PWA gate (for development/testing)
 */
export const shouldBypassPWAGate = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return email.toLowerCase() === 'calvinjschofield@gmail.com';
};

/**
 * Tracks that user has signed up at least once on this device
 */
export const markUserSignedUp = () => {
  localStorage.setItem('kaizen-has-signed-up', 'true');
};

/**
 * Checks if user has ever signed up on this device
 */
export const hasUserSignedUp = (): boolean => {
  return localStorage.getItem('kaizen-has-signed-up') === 'true';
};
