import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.00427502ff944cc991616496e2600071',
  appName: 'kaizen-better-every-day',
  webDir: 'dist',
  server: {
    url: 'https://00427502-ff94-4cc9-9161-6496e2600071.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  ios: {
    contentInset: 'automatic',
    // These will be applied when you run `npx cap sync`
    // But Info.plist entries must be added manually in Xcode
  }
};

export default config;
