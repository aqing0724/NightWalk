import { useEffect, useRef, useState } from "react";
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
import { useTheme } from "../ThemeContext"; // 🎯 1. 物理修正：使用兩個點精準跳出資料夾，安全引入主題管家

const homeIcon = require("../../assets/home.png");
const homeActiveIcon = require("../../assets/home-on.png");
const plusIcon = require("../../assets/Plus.png");
const userIcon = require("../../assets/user.png");
const userActiveIcon = require("../../assets/user-on.png");

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
  // 🎯 2. 核心注入：在組件最頂層撈出 themeMode 與 colors，確保底下的 return 100% 抓得到變數
  const { themeMode, colors: globalColors } = useTheme(); 
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
        {/* 🎯 3. 物理變色：在 View 上直接用陣列樣式改寫 navBar 底色，白天純白，黑夜切換為你指定的質感炭灰 */}
        <View
          style={[
            styles.navBar,
            {
              backgroundColor:
                themeMode === "dark" ? globalColors.handle : colors.white,
            },
          ]}
        >
          {barWidth ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.activePill,
                {
                  transform: [{ translateX: pillTranslateX }],
                  width: itemWidth - 8,
                  // 🎯 當前選中發亮膠囊的底色，夜間模式時自動適應深莫蘭迪綠，避免過亮刺眼
                  backgroundColor: themeMode === "dark" ? "#344039" : colors.specialSoft, 
                },
              ]}
            />
          ) : null}

          {renderItem({
            accessibilityLabel: "Home",
            icon: (
              <Image
                source={activeIndex === 0 ? homeActiveIcon : homeIcon}
                style={[
                  styles.navIcon,
                  activeIndex === 0 ? styles.navIconActive : null,
                  // 🎯 4. 圖示反轉：非選中狀態的 Home 圖示，在夜間自動從黑色轉化為反差白
                  { tintColor: activeIndex === 0 ? colors.special : (themeMode === "dark" ? "#FFFFFF" : colors.black) }
                ]}
              />
            ),
            onPress: () => navigateIfNeeded("/"),
          })}

          {renderItem({
            accessibilityLabel: "Add",
            icon: (
              <Image
                source={plusIcon}
                style={[
                  styles.addIcon,
                  activeIndex === 1 ? styles.navIconActive : null,
                  // 🎯 5. 加號反轉：中間大加號在夜間模式下直接強制改為純白色
                  { tintColor: activeIndex === 1 ? colors.special : (themeMode === "dark" ? "#FFFFFF" : colors.black) }
                ]}
              />
            ),
            onPress: handleAddPress,
          })}

          {renderItem({
            accessibilityLabel: "Profile",
            icon: (
              <Image
                source={activeIndex === 2 ? userActiveIcon : userIcon}
                style={[
                  styles.navIcon,
                  activeIndex === 2 ? styles.navIconActive : null,
                  // 🎯 6. 個人頭像反轉：夜間未選中時自動切換成白，不再被黑色背景吞掉
                  { tintColor: activeIndex === 2 ? colors.special : (themeMode === "dark" ? "#FFFFFF" : colors.black) }
                ]}
              />
            ),
            onPress: handleProfilePress,
          })}
        </View>
      </View>
    </View>
  );
}

// 🎯 下方的 StyleSheet.create 恢復成最乾淨安全的純結構靜態樣式，絕不殘留動態變數，保證絕不噴錯！
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
    borderColor: colors.divider,
    flexDirection: "row",
    alignItems: "center",
  },
  activePill: {
    position: "absolute",
    top: 5,
    bottom: 5,
    left: 4,
    borderRadius: 27,
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
  },
  navIconActive: {
    opacity: 1,
  },
  addIcon: {
    width: 46,
    height: 46,
    opacity: 0.82,
    resizeMode: "contain",
  },
});
