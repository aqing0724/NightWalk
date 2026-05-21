import { useEffect, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";
import { usePathname, useRouter } from "expo-router";

import AuthModal from "./AuthModal";
import useGoogleSignIn from "../hooks/useGoogleSignIn";

const homeIcon = require("../../assets/Home-black.png");
const userIcon = require("../../assets/User-black.png");

export default function BottomNavigation({ activeRoute = "home" }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authVisible, setAuthVisible] = useState(false);
  const {
    error,
    isReady,
    isSigningIn,
    signInWithGoogle,
    signOutFromGoogle,
    user,
  } = useGoogleSignIn();

  function navigateIfNeeded(nextPath) {
    if (pathname === nextPath) {
      return;
    }

    router.push(nextPath);
  }

  async function handleProfilePress() {
    if (user) {
      Alert.alert(
        "已登入",
        user.displayName || user.email || "Google 帳號已登入",
        [
          { text: "取消", style: "cancel" },
          {
            text: "登出",
            style: "destructive",
            onPress: signOutFromGoogle,
          },
        ]
      );
      return;
    }

    setAuthVisible(true);
  }

  useEffect(() => {
    if (user) {
      setAuthVisible(false);
    }
  }, [user]);

  return (
    <>
      <View style={styles.navWrap}>
        <View style={styles.navBar}>
          <Pressable
            accessibilityLabel="Home"
            accessibilityRole="button"
            onPress={() => navigateIfNeeded("/")}
            style={styles.navItem}
          >
            <Image source={homeIcon} style={styles.navIcon} />
          </Pressable>

          <View style={styles.centerSlot} />

          <Pressable
            accessibilityLabel="Profile"
            accessibilityRole="button"
            disabled={isSigningIn}
            onPress={handleProfilePress}
            style={styles.navItem}
          >
            <Image
              source={userIcon}
              style={[styles.navIcon, user ? styles.navIconActive : null]}
            />
          </Pressable>
        </View>

        <Pressable
          accessibilityLabel="Add"
          accessibilityRole="button"
          onPress={() => navigateIfNeeded("/Add")}
          style={[
            styles.addButton,
            activeRoute === "add" ? styles.addButtonActive : null,
          ]}
        >
          <View style={styles.addVertical} />
          <View style={styles.addHorizontal} />
        </Pressable>
      </View>

      <AuthModal
        googleError={error}
        isGoogleReady={isReady}
        isGoogleSigningIn={isSigningIn}
        onClose={() => setAuthVisible(false)}
        onGoogleSignIn={signInWithGoogle}
        visible={authVisible}
      />
    </>
  );
}

const styles = StyleSheet.create({
  navWrap: {
    position: "relative",
    alignItems: "center",
  },
  navBar: {
    width: "100%",
    height: 75,
    paddingHorizontal: 52,
    paddingTop: 20,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  navItem: {
    width: 66,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  centerSlot: {
    width: 66,
  },
  navIcon: {
    width: 30,
    height: 30,
    resizeMode: "contain",
  },
  navIconActive: {
    tintColor: "#AFC2B5",
  },
  addButton: {
    position: "absolute",
    top: -20,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#9cad9f",
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonActive: {
    backgroundColor: "#AFC2B5",
  },
  addVertical: {
    position: "absolute",
    width: 4,
    height: 36,
    borderRadius: 2,
    backgroundColor: "#ffffff",
  },
  addHorizontal: {
    position: "absolute",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ffffff",
  },
});
