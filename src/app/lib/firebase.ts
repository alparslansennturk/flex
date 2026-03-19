import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBimNOLcg4CmsIB4dpXF2WbIU5nY7TfevY",
  authDomain: "flexos-10ac4.firebaseapp.com",
  projectId: "flexos-10ac4",
  storageBucket: "flexos-10ac4.firebasestorage.app",
  messagingSenderId: "421929361498",
  appId: "1:421929361498:web:c9348204f583727d3a7863"
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