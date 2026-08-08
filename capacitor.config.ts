import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.owais.myser',
  appName: 'Myser',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    // iOS defaults to the non-standard `capacitor://` custom scheme, which
    // Firebase Auth's SDK doesn't reliably work under — it depends on a
    // cross-origin iframe/postMessage handshake with
    // <project>.firebaseapp.com/__/auth/iframe that assumes a standard
    // http(s) origin context. Android was already explicitly overridden to
    // `https` above (presumably for this exact reason); mirror that for iOS
    // so both platforms match the origin type Firebase actually supports.
    iosScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com', 'apple.com'],
    },
  },
};

export default config;
