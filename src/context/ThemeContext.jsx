import React, { createContext, useEffect, useState, useCallback } from "react";
import {
  applyTheme,
  resolveStoredTheme,
  getSnowIntensity,
  setSnowIntensity as persistSnowIntensity,
  PINK_SNOW_THEME,
} from "@/utils/theme/themeUtils";

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => resolveStoredTheme() || PINK_SNOW_THEME);
  const [snowIntensity, setSnowIntensityState] = useState(() =>
    getSnowIntensity(),
  );

  const changeTheme = useCallback((newTheme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  }, []);

  const changeSnowIntensity = useCallback((level) => {
    const v = persistSnowIntensity(level);
    setSnowIntensityState(v);
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    persistSnowIntensity(snowIntensity);
  }, [snowIntensity]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        changeTheme,
        snowIntensity,
        changeSnowIntensity,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
