import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dmitechnologies.app',
  appName: 'DMi Technologies POS',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
