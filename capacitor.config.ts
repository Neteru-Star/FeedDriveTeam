import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.feeddrive.app',
  appName: 'FeedDrive',
  webDir: 'www',
  server: {
    // The API is served over plain HTTP, which an https:// WebView blocks as mixed content.
    androidScheme: 'http',
    cleartext: true,
  },
};

export default config;
