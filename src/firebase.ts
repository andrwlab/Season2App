import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// ⬇️ Sustituye los datos con los de tu proyecto Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBnCUSs7kB_vM7Pg_-Ib9CWvPJ99pxGYQk",
    authDomain: "webtorneitoapp.firebaseapp.com",
    projectId: "webtorneitoapp",
    storageBucket: "webtorneitoapp.firebasestorage.app",
    messagingSenderId: "1044341561885",
    appId: "1:1044341561885:web:a8d456248a9209668184f4",
    measurementId: "G-3FGSQNXL5N"
  };

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
});
export const auth = getAuth(app);
export const storage = getStorage(app);
