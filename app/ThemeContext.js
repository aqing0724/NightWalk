import React, { createContext, useContext, useState } from "react";
import { themeColors } from "./constants/theme"; // 確保路徑對齊你的 theme.js

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = useState("light"); // 'light' 或 'dark'

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  const colors = themeColors[themeMode];

  return (
    <ThemeContext.Provider value={{ themeMode, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}