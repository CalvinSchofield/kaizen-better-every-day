import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

interface GeoResult {
  latitude: number;
  longitude: number;
}

/**
 * Get current position using Capacitor native API on iOS/Android,
 * falling back to browser navigator.geolocation on web.
 * 
 * On native, this properly triggers the iOS permission prompt.
 */
export const getNativePosition = async (): Promise<GeoResult> => {
  if (Capacitor.isNativePlatform()) {
    // Request permissions first (required on iOS to trigger the native prompt)
    const permStatus = await Geolocation.checkPermissions();
    if (permStatus.location === 'prompt' || permStatus.location === 'prompt-with-rationale') {
      await Geolocation.requestPermissions();
    }
    
    if (permStatus.location === 'denied') {
      throw new Error('Location permission denied. Please enable it in Settings.');
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
    });
    
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  }

  // Web fallback
  if (!navigator.geolocation) {
    throw new Error('Location not supported on this device');
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
    });
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
};
