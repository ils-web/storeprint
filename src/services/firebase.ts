import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

let firebaseConfig: any = null;

try {
  // Load from firebase-applet-config.json if available
  // @ts-ignore
  import('../../firebase-applet-config.json').then((module) => {
    firebaseConfig = module.default || module;
  });
} catch (e) {
  console.warn('No local firebase-applet-config.json found, using environment variables.');
}

// Fallback config from Applet defaults
const DEFAULT_FIREBASE_CONFIG = {
  projectId: "zeta-sanctum-0j4jh",
  appId: "1:1080969786292:web:f351e432beb1eceef278e1",
  apiKey: "AIzaSyCYBC6H-afVLv1ILxqSmEXXXLeFHHu4W30",
  authDomain: "zeta-sanctum-0j4jh.firebaseapp.com",
  storageBucket: "zeta-sanctum-0j4jh.firebasestorage.app",
  messagingSenderId: "1080969786292",
};

export const app = getApps().length === 0 
  ? initializeApp(firebaseConfig || DEFAULT_FIREBASE_CONFIG) 
  : getApp();

export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);
export const isFirebaseReady = Boolean(app && db);
