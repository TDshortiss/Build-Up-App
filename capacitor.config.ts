import type { CapacitorConfig } from '@capacitor/cli';

// The iPhone app (Capacitor). It bundles the same web app that runs on builduptraining.com, built with
// `npm run build:ios`, so it opens instantly and works offline. See ios/README.md for how to build and upload it.
const config: CapacitorConfig = {
  appId: 'com.builduptraining.app',
  appName: 'Build Up',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    backgroundColor: '#15212B',
    // Links to other sites open in Safari instead of replacing the app.
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: { launchShowDuration: 600, launchAutoHide: true, backgroundColor: '#15212B', showSpinner: false },
    LocalNotifications: { iconColor: '#15212B' },
  },
};

export default config;
