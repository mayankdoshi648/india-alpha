"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useThemePref } from "@/components/dashboard/theme-provider";
import { THEME_OPTIONS, type ThemePref } from "@/lib/theme";
import { cn } from "@/lib/utils";

const ICONS: Record<ThemePref, typeof Sun> = {
  light: Sun,
  dark: Moon,
  auto: Monitor,
};

export function ThemeToggle() {
  const { pref, setPref } = useThemePref();
  return (
    <div
      className="flex overflow-hidden rounded-md border border-white/10"
      role="tablist"
      aria-label="Color theme"
    >
      {THEME_OPTIONS.map((opt) => {
        const Icon = ICONS[opt.id];
        const on = pref === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-label={opt.label}
            aria-selected={on}
            id={`theme-${opt.id}`}
            onClick={() => setPref(opt.id)}
            className={cn(
              "inline-flex h-7 items-center gap-1 px-2 text-[12px]",
              on
                ? "bg-cyan-400/20 text-cyan-100"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
