import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

const FIREBASE_CONFIG = {
  projectId: "storeprint-8fab1",
  appId: "1:796973894702:web:e20b822681117494f423bf",
  apiKey: "AIzaSyAvk9urcRChSpRge0az1Wx59EfzpKR6A3Q",
  authDomain: "storeprint-8fab1.firebaseapp.com",
  storageBucket: "storeprint-8fab1.firebasestorage.app",
  messagingSenderId: "796973894702",
  measurementId: "G-VQHD2GVQKR",
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
