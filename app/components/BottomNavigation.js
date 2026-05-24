import { useEffect, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../../firebase";

const homeIcon = require("../../assets/Home-black.png");
const userIcon = require("../../assets/User-black.png");

export default function BottomNavigation({ activeRoute = "home" }) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  useEffect(() => {
    return onAuthStateChanged(auth, setCurrentUser);
  }, []);

  function navigateIfNeeded(nextPath) {
    if (pathname === nextPath) {
      return;
    }

    router.push(nextPath);
  }

  function handleAddPress() {
    if (!currentUser) {
      Alert.alert("請先登入", "登入後才能新增危險地點回報。", [
        { text: "取消", style: "cancel" },
        { text: "前往登入", onPress: () => navigateIfNeeded("/Login") },
      ]);
      return;
    }

    navigateIfNeeded("/Add");
  }

  function handleProfilePress() {
    navigateIfNeeded(currentUser ? "/Account" : "/Login");
  }

  return (
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
          onPress={handleProfilePress}
          style={styles.navItem}
        >
          <Image source={userIcon} style={styles.navIcon} />
        </Pressable>
      </View>

      <Pressable
        accessibilityLabel="Add"
        accessibilityRole="button"
        onPress={handleAddPress}
        style={[
          styles.addButton,
          activeRoute === "add" ? styles.addButtonActive : null,
        ]}
      >
        <View style={styles.addVertical} />
        <View style={styles.addHorizontal} />
      </Pressable>
    </View>
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
