"use client";

import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export const THEME_KEY = "documind-theme";

/** Reactively reports whether the <html> element currently has the `dark` class. */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export function toggleTheme() {
  const el = document.documentElement;
  el.classList.add("theme-anim");
  const next = !el.classList.contains("dark");
  el.classList.toggle("dark", next);
  try { localStorage.setItem(THEME_KEY, next ? "dark" : "light"); } catch { }
  window.setTimeout(() => el.classList.remove("theme-anim"), 350);
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const dark = useIsDark();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={`relative w-8 h-8 rounded-xl flex items-center justify-center text-muted hover:text-ink hover:bg-hover transition-colors overflow-hidden ${className}`}
    >
      <Sun size={18} className={`absolute transition-all duration-300 ${dark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
      <Moon size={18} className={`absolute transition-all duration-300 ${dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`} />
    </button>
  );
}
