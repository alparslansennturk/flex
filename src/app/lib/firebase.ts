import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const existingApp = getApps().length > 0;
const app = existingApp ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

// gRPC watch stream'in ~2dk'da bir reconnect etmesindeki ca9 bug'ını önlemek için
// HTTP long-polling kullan. initializeFirestore sadece ilk kez çağrılabilir.
const db = existingApp
  ? getFirestore(app)
  : initializeFirestore(app, { experimentalForceLongPolling: true });

export { app, auth, db };