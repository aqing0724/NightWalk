import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  setPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

import { firebaseConfig } from "./firebaseConfig";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const nativePersistence = getReactNativePersistence(ReactNativeAsyncStorage);

function getPersistentAuth() {
  try {
    return initializeAuth(app, {
      persistence: nativePersistence,
    });
  } catch (error) {
    if (error.code === "auth/already-initialized") {
      return getAuth(app);
    }

    throw error;
  }
}

export const auth = getPersistentAuth();
export const authReady = setPersistence(auth, nativePersistence)
  .then(() => auth.authStateReady())
  .catch((error) => {
    console.error("Firebase Auth persistence initialization failed:", error);
    throw error;
  });
export const db = getFirestore(app);
export const storage = getStorage(app);
