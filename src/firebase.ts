import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Firebase web configuration for Season2App.
const firebaseConfig = {
  apiKey: "AIzaSyBnCUSs7kB_vM7Pg_-Ib9CWvPJ99pxGYQk",
  authDomain: "webtorneitoapp.firebaseapp.com",
  projectId: "webtorneitoapp",
  storageBucket: "webtorneitoapp.firebasestorage.app",
  messagingSenderId: "1044341561885",
  appId: "1:1044341561885:web:a8d456248a9209668184f4",
  measurementId: "G-3FGSQNXL5N",
};

export const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
});
export const auth = getAuth(app);
export const storage = getStorage(app);

// Analytics is optional at runtime (for example, some browsers/ad blockers disable it).
// Audience heartbeat tracking still works through Firestore when GA4 is unavailable.
export const analyticsPromise: Promise<Analytics | null> =
  typeof window === "undefined"
    ? Promise.resolve(null)
    : isSupported()
        .then((supported) => (supported ? getAnalytics(app) : null))
        .catch((error) => {
          console.warn("Firebase Analytics is unavailable in this browser.", error);
          return null;
        });
