import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.calvinschofield.kaizen.better.everyday',
  appName: 'Kaizen',
  webDir: 'dist',

  server: {
    url: 'https://kaizen-better-every-day.lovable.app',
    cleartext: true
  }

};

export default config;
