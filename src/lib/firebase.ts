import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
// getAuth(app) unconditionally sets up Firebase Auth's iframe-based
// AuthEventManager (loads Google's gapi_iframes helper from
// apis.google.com) for every web Auth instance, regardless of sign-in
// method — it's needed for signInWithPopup/signInWithRedirect, not for
// plain email/password. In the Capacitor iOS WKWebView, that cross-origin
// iframe setup was failing outright (confirmed via a real device test:
// Network Logs showed gapi_iframes load, then hit its own debug_error/
// jserror reporting path), which blocked even createUserWithEmailAndPassword
// forever since it never got past Auth's init step. initializeAuth with
// popupRedirectResolver: undefined skips that setup entirely — this is
// Firebase's own documented pattern for apps that don't use the web
// popup/redirect flow (native platforms here use native sign-in plugins
// instead). The one remaining web-browser code path that still needs
// signInWithPopup passes browserPopupRedirectResolver explicitly per-call
// (see LoginPage.tsx) since signInWithPopup accepts a resolver override.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: undefined,
});
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
