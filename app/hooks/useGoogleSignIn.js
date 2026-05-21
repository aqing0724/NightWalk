import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
} from "firebase/auth";

import { auth } from "../../firebase";

WebBrowser.maybeCompleteAuthSession();

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

const googleAuthConfig = {
  clientId: googleWebClientId || "missing-google-web-client-id",
  webClientId: googleWebClientId || "missing-google-web-client-id",
  iosClientId: googleIosClientId,
  androidClientId: googleAndroidClientId,
  scopes: ["openid", "profile", "email"],
  selectAccount: true,
};

function getMissingClientIdMessage() {
  if (Platform.OS === "ios" && !googleIosClientId) {
    return "請先在 .env 填入 EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID，並使用 development build 測試 Google 登入。";
  }

  if (Platform.OS === "android" && !googleAndroidClientId) {
    return "請先在 .env 填入 EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID，並使用 development build 測試 Google 登入。";
  }

  if (!googleWebClientId) {
    return "請先在 .env 填入 EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID，然後重啟 Expo。";
  }

  return "";
}

export default function useGoogleSignIn() {
  const [user, setUser] = useState(auth.currentUser);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState(null);
  const [request, response, promptAsync] =
    Google.useIdTokenAuthRequest(googleAuthConfig);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function finishGoogleSignIn() {
      if (response?.type !== "success") {
        if (response?.type === "error") {
          setError(response.error ?? new Error("Google sign-in failed."));
        }
        setIsSigningIn(false);
        return;
      }

      const idToken = response.params?.id_token;
      const accessToken =
        response.params?.access_token ?? response.authentication?.accessToken;

      if (!idToken) {
        setError(new Error("Google did not return an ID token."));
        setIsSigningIn(false);
        return;
      }

      try {
        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        await signInWithCredential(auth, credential);
      } catch (signInError) {
        if (isMounted) {
          setError(signInError);
        }
      } finally {
        if (isMounted) {
          setIsSigningIn(false);
        }
      }
    }

    finishGoogleSignIn();

    return () => {
      isMounted = false;
    };
  }, [response]);

  async function signInWithGoogle() {
    const missingClientIdMessage = getMissingClientIdMessage();

    if (missingClientIdMessage) {
      const missingClientIdError = new Error(missingClientIdMessage);
      setError(missingClientIdError);
      throw missingClientIdError;
    }

    setError(null);
    setIsSigningIn(true);

    let result;

    try {
      result = await promptAsync();
    } catch (promptError) {
      setError(promptError);
      setIsSigningIn(false);
      throw promptError;
    }

    if (result.type !== "success") {
      setIsSigningIn(false);
    }

    return result;
  }

  return {
    error,
    isReady: Boolean(request),
    isSigningIn,
    signInWithGoogle,
    signOutFromGoogle: () => signOut(auth),
    user,
  };
}
