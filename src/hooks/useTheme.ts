import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "nim-office.theme";

function readStored(): ThemeMode {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === "light" || value === "dark" ? value : "system";
}

function prefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
  return dark;
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(readStored);
  const [isDark, setIsDark] = useState(() => apply(readStored()));

  useEffect(() => {
    setIsDark(apply(mode));
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    if (mode !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setIsDark(apply("system"));
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((current) => {
      const currentlyDark =
        current === "dark" || (current === "system" && prefersDark());
      return currentlyDark ? "light" : "dark";
    });
  }, []);

  return { mode, isDark, setMode, toggle };
}
