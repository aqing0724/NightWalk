import React, { createContext, useContext, useState } from "react";
import { themeColors } from "./constants/theme"; // 確保路徑對齊你的 theme.js
export const AVATARS = {
  avatar1: require("../assets/avatar1.png"),
  avatar2: require("../assets/avatar2.png"),
  avatar3: require("../assets/avatar3.png"),
};
const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = useState("light"); // 'light' 或 'dark'
const [currentAvatarId, setCurrentAvatarId] = useState("avatar1");
  const toggleTheme = () => {
    setThemeMode((prev) => (prev === "light" ? "dark" : "light"));
  };
  const changeAvatar = (avatarId) => {
    if (AVATARS[avatarId]) {
      setCurrentAvatarId(avatarId);
    }
  };

  const colors = themeColors[themeMode];

  return (
    <ThemeContext.Provider 
      value={{ 
        themeMode, 
        colors, 
        toggleTheme,
        
        // 🎯 4. 完美融合：把頭像的狀態與控制功能塞進 Provider 給全 App 訂閱
        currentAvatarId,                  // 當前頭像的字串 ID（例如 'avatar1'）
        currentAvatarSource: AVATARS[currentAvatarId], // 直接回傳 require 圖片資產，可直接塞給 Image source
        changeAvatar,                     // 呼叫變換頭像的動作
        allAvatars: AVATARS,              // 釋放整張頭像表，供個人頁面選單渲染使用
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}