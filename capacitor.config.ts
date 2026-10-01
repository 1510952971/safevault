import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.safevault.app',
  appName: 'SafeVault',
  webDir: 'dist',
  server: {
    cleartext: true
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
