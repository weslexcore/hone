"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { getTheme, setTheme as persistTheme, type ThemeId } from "@/lib/storage/theme";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "default",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("default");

  // Read persisted theme on mount
  useEffect(() => {
    setThemeState(getTheme());
  }, []);

  // Apply data-theme attribute to <html> whenever it changes
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t);
    persistTheme(t);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
