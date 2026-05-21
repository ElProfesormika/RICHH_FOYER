import { useCallback, useEffect, useState } from "react";
import { applyTheme, getStoredTheme, type Theme } from "../theme";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle, isLight: theme === "light" };
}
