import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

const FIREBASE_CONFIG = {
  projectId: "zeta-sanctum-0j4jh",
  appId: "1:1080969786292:web:f351e432beb1eceef278e1",
  apiKey: "AIzaSyCYBC6H-afVLv1ILxqSmEXXXLeFHHu4W30",
  authDomain: "zeta-sanctum-0j4jh.firebaseapp.com",
  storageBucket: "zeta-sanctum-0j4jh.firebasestorage.app",
  messagingSenderId: "1080969786292",
};

export const app = getApps().length === 0 
  ? initializeApp(FIREBASE_CONFIG) 
  : getApp();

export let db: Firestore | null = null;
export let auth: Auth | null = null;
export let isFirebaseReady = false;

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
