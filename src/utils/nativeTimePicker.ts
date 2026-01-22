import { DatePicker } from '@capacitor-community/date-picker';
import { isNativeApp } from './platform';

/**
 * Show native time picker on iOS (wheel/drum style)
 * Returns the selected time in HH:MM format, or null if cancelled
 */
export async function showNativeTimePicker(currentTime: string): Promise<string | null> {
  if (!isNativeApp()) {
    // Web fallback - return null to trigger HTML input
    return null;
  }
  
  try {
    const [hours, minutes] = currentTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    
    const result = await DatePicker.present({
      mode: 'time',
      date: date.toISOString(),
      theme: 'dark',
      is24h: false,
      ios: {
        style: 'wheels', // The native drum picker!
      },
    });
    
    if (result.value) {
      const selected = new Date(result.value);
      return `${selected.getHours().toString().padStart(2, '0')}:${selected.getMinutes().toString().padStart(2, '0')}`;
    }
    return null;
  } catch (error) {
    console.error('Native time picker error:', error);
    return null;
  }
}

/**
 * Check if native time picker is available
 */
export function hasNativeTimePicker(): boolean {
  return isNativeApp();
}
