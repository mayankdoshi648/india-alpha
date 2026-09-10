"use client";

import { Toaster } from "sonner";
import { useThemePref } from "@/components/dashboard/theme-provider";

export function ThemeToaster() {
  const { pref } = useThemePref();
  return <Toaster theme={pref === "auto" ? "system" : pref} />;
}
