export type ThemePref = "light" | "dark" | "auto";

export const THEME_KEY = "imd-theme";
export const THEME_OPTIONS: { id: ThemePref; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "auto", label: "Auto" },
];

export function readThemePref(): ThemePref {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === "light" || raw === "dark" || raw === "auto") return raw;
  } catch {
    // ignore
  }
  return "dark";
}

export function resolvedDark(pref: ThemePref, mq = false): boolean {
  if (pref === "light") return false;
  if (pref === "dark") return true;
  if (typeof window === "undefined") return mq;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(pref: ThemePref) {
  const dark = resolvedDark(pref);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.dataset.theme = pref;
  root.style.colorScheme = dark ? "dark" : "light";
}

export const THEME_BOOT = `(function(){try{var t=localStorage.getItem("imd-theme")||"dark";if(t!=="light"&&t!=="dark"&&t!=="auto")t="dark";var d=t==="dark"||(t==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.dataset.theme=t;r.style.colorScheme=d?"dark":"light";}catch(e){document.documentElement.classList.add("dark");}})();`;
