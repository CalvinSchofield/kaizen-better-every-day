import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNativeApp } from './platform';

/**
 * Trigger a light haptic impact - for subtle UI feedback
 */
export const hapticLight = async (): Promise<void> => {
  if (isNativeApp()) {
    await Haptics.impact({ style: ImpactStyle.Light });
  } else if (navigator.vibrate) {
    navigator.vibrate(10);
  }
};

/**
 * Trigger a medium haptic impact - for button taps
 */
export const hapticMedium = async (): Promise<void> => {
  if (isNativeApp()) {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } else if (navigator.vibrate) {
    navigator.vibrate(20);
  }
};

/**
 * Trigger a heavy haptic impact - for significant actions
 */
export const hapticHeavy = async (): Promise<void> => {
  if (isNativeApp()) {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } else if (navigator.vibrate) {
    navigator.vibrate(30);
  }
};

/**
 * Trigger a success haptic notification
 */
export const hapticSuccess = async (): Promise<void> => {
  if (isNativeApp()) {
    await Haptics.notification({ type: NotificationType.Success });
  } else if (navigator.vibrate) {
    navigator.vibrate([20, 50, 20]);
  }
};

/**
 * Trigger a warning haptic notification
 */
export const hapticWarning = async (): Promise<void> => {
  if (isNativeApp()) {
    await Haptics.notification({ type: NotificationType.Warning });
  } else if (navigator.vibrate) {
    navigator.vibrate([30, 50, 30]);
  }
};

/**
 * Trigger an error haptic notification
 */
export const hapticError = async (): Promise<void> => {
  if (isNativeApp()) {
    await Haptics.notification({ type: NotificationType.Error });
  } else if (navigator.vibrate) {
    navigator.vibrate([50, 50, 50]);
  }
};

/**
 * Trigger selection changed haptic - for swipes, toggles
 */
export const hapticSelection = async (): Promise<void> => {
  if (isNativeApp()) {
    await Haptics.selectionChanged();
  } else if (navigator.vibrate) {
    navigator.vibrate(5);
  }
};
