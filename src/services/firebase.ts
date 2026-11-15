import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth, signInAnonymously } from 'firebase/auth';

const env = typeof import.meta !== 'undefined' ? (import.meta as unknown as { env?: Record<string, string | undefined> }).env : undefined;

const FIREBASE_CONFIG = {
  projectId: env?.VITE_FIREBASE_PROJECT_ID || 'storeprint-8fab1',
  appId: env?.VITE_FIREBASE_APP_ID || '1:796973894702:web:e20b822681117494f423bf',
  apiKey: env?.VITE_FIREBASE_API_KEY || 'AIzaSyAvk9urcRChSpRge0az1Wx59EfzpKR6A3Q',
  authDomain: env?.VITE_FIREBASE_AUTH_DOMAIN || 'storeprint-8fab1.firebaseapp.com',
  storageBucket: env?.VITE_FIREBASE_STORAGE_BUCKET || 'storeprint-8fab1.firebasestorage.app',
  messagingSenderId: env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '796973894702',
  measurementId: env?.VITE_FIREBASE_MEASUREMENT_ID || 'G-VQHD2GVQKR',
};

export const app = getApps().length === 0
  ? initializeApp(FIREBASE_CONFIG)
  : getApp();

export let db: Firestore | null = null;
export let auth: Auth | null = null;
export let isFirebaseReady = false;

let authInitPromise: Promise<boolean> | null = null;
let authDisabledInSession = false;

try {
  if (app) {
    db = getFirestore(app);
    auth = getAuth(app);
    isFirebaseReady = true;
  }
} catch (e) {
  console.warn('Firestore not active, operating in offline/Sheets mode.', e);
  isFirebaseReady = false;
}

/**
 * Ensures an anonymous Firebase Auth session exists before reading/writing Firestore
 * so hardened security rules requiring `request.auth != null` succeed seamlessly.
 * Fails gracefully if Anonymous Auth is not yet enabled in Firebase Console.
 */
export async function ensureFirebaseAuth(): Promise<boolean> {
  if (!auth || authDisabledInSession) return false;
  if (auth.currentUser) return true;
  if (authInitPromise) return authInitPromise;

  authInitPromise = signInAnonymously(auth)
    .then(() => true)
    .catch((err) => {
      const code = (err as { code?: string })?.code || '';
      if (
        code === 'auth/operation-not-allowed' ||
        code === 'auth/admin-restricted-operation' ||
        code.includes('api-key-not-valid')
      ) {
        authDisabledInSession = true;
        console.warn(`Firebase Anonymous Auth unavailable (${code}); continuing without Auth token.`);
      } else {
        console.warn('Firebase Auth anonymous sign-in skipped:', err);
      }
      return false;
    })
    .finally(() => {
      authInitPromise = null;
    });

  return authInitPromise;
}
