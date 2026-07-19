import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, getFirestore } from "firebase/firestore";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";

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

/**
 * FCM Messaging — SADECE tarayıcı + destekleniyorsa (`isSupported()`, Safari'nin
 * eski sürümleri/SSR'da `false` döner) lazy başlatılır. Modül yüklenirken
 * `getMessaging()` doğrudan çağrılırsa SSR'da patlar, bu yüzden fonksiyon.
 */
let messagingPromise: Promise<Messaging | null> | null = null;
export function getMessagingIfSupported(): Promise<Messaging | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!messagingPromise) {
    messagingPromise = isSupported().then((ok) => (ok ? getMessaging(app) : null));
  }
  return messagingPromise;
}

export { app, auth, db };