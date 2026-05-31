import { useEffect, useRef, useState } from "react";
import { BlurView } from "expo-blur";
import {
  Alert,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { usePathname, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../../firebase";
import { colors } from "../constants/theme";

const homeIcon = require("../../assets/Home-black.png");
const userIcon = require("../../assets/User-black.png");

function getActiveIndex(pathname) {
  if (pathname === "/Add") {
    return 1;
  }

  if (pathname === "/Account" || pathname === "/Login") {
    return 2;
  }

  return 0;
}

export default function BottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const activeIndex = getActiveIndex(pathname);
  const slideAnimation = useRef(new Animated.Value(activeIndex)).current;
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [barWidth, setBarWidth] = useState(0);
  const itemWidth = barWidth / 3;
  const pillTranslateX = slideAnimation.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, itemWidth, itemWidth * 2],
  });

  useEffect(() => {
    return onAuthStateChanged(auth, setCurrentUser);
  }, []);

  useEffect(() => {
    Animated.spring(slideAnimation, {
      toValue: activeIndex,
      friction: 8,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, slideAnimation]);

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

  function renderItem({ accessibilityLabel, icon, onPress }) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.navItem,
          pressed ? styles.navItemPressed : null,
        ]}
      >
        {icon}
      </Pressable>
    );
  }

  return (
    <View style={styles.navWrap}>
      <View
        onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
        style={styles.navFrame}
      >
        <BlurView
          experimentalBlurMethod="dimezisBlurView"
          intensity={70}
          tint="systemMaterial"
          style={styles.navBar}
        >
          {barWidth ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.activePill,
                {
                  transform: [{ translateX: pillTranslateX }],
                  width: itemWidth - 8,
                },
              ]}
            />
          ) : null}

          {renderItem({
            accessibilityLabel: "Home",
            icon: (
              <Image
                source={homeIcon}
                style={[
                  styles.navIcon,
                  activeIndex === 0 ? styles.navIconActive : null,
                ]}
              />
            ),
            onPress: () => navigateIfNeeded("/"),
          })}

          {renderItem({
            accessibilityLabel: "Add",
            icon: (
              <View style={styles.addIcon}>
                <View
                  style={[
                    styles.addVertical,
                    activeIndex === 1 ? styles.addStrokeActive : null,
                  ]}
                />
                <View
                  style={[
                    styles.addHorizontal,
                    activeIndex === 1 ? styles.addStrokeActive : null,
                  ]}
                />
              </View>
            ),
            onPress: handleAddPress,
          })}

          {renderItem({
            accessibilityLabel: "Profile",
            icon: (
              <Image
                source={userIcon}
                style={[
                  styles.navIcon,
                  activeIndex === 2 ? styles.navIconActive : null,
                ]}
              />
            ),
            onPress: handleProfilePress,
          })}
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navWrap: {
    position: "relative",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  navFrame: {
    width: "100%",
    height: 64,
    borderRadius: 32,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 18,
  },
  navBar: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    borderRadius: 32,
    borderWidth: 0,
    borderColor: colors.glassWhiteBorder,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.glassDark,
  },
  activePill: {
    position: "absolute",
    top: 5,
    bottom: 5,
    left: 4,
    borderRadius: 27,
    backgroundColor: colors.glassWhiteSoft,
  },
  navItem: {
    flex: 1,
    height: "100%",
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  navItemPressed: {
    transform: [{ scale: 0.96 }],
  },
  navIcon: {
    width: 26,
    height: 26,
    opacity: 0.82,
    resizeMode: "contain",
    tintColor: colors.white,
  },
  navIconActive: {
    opacity: 1,
    tintColor: colors.special,
  },
  addIcon: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  addVertical: {
    position: "absolute",
    width: 3,
    height: 26,
    borderRadius: 1.5,
    backgroundColor: colors.white,
  },
  addHorizontal: {
    position: "absolute",
    width: 26,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.white,
  },
  addStrokeActive: {
    backgroundColor: colors.special,
  },
});
