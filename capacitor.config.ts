import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.00427502ff944cc991616496e2600071',
  appName: 'kaizen-better-every-day',
  webDir: 'dist',
  // NOTE: For development with hot-reload, uncomment the server block below.
  // For TestFlight/production builds, keep it commented out so the app uses local bundled assets.
  // server: {
  //   url: 'https://00427502-ff94-4cc9-9161-6496e2600071.lovableproject.com?forceHideBadge=true',
  //   cleartext: true
  // },
  ios: {
    contentInset: 'automatic',
  },
  plugins: {
    Keyboard: {
      resize: 'none',
      style: 'DEFAULT',
    },
  },
};

export default config;
