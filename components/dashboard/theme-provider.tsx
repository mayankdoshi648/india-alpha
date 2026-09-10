"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { applyTheme, readThemePref, THEME_KEY, type ThemePref } from "@/lib/theme";

const ThemeCtx = createContext<{
  pref: ThemePref;
  setPref: (next: ThemePref) => void;
}>({ pref: "dark", setPref: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>("dark");

  useEffect(() => {
    const next = readThemePref();
    setPrefState(next);
    applyTheme(next);
  }, []);

  useEffect(() => {
    if (pref !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("auto");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const setPref = (next: ThemePref) => {
    setPrefState(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // ignore
    }
    applyTheme(next);
  };

  const value = useMemo(() => ({ pref, setPref }), [pref]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useThemePref() {
  return useContext(ThemeCtx);
}
