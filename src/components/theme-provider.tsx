import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicBranding } from "@/lib/branding.functions";

type Theme = "light" | "dark";

type Ctx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
  branding: { brandName: string; brandLogoUrl: string | null } | null;
};

const ThemeCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "argos-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const fetchBranding = useServerFn(getPublicBranding);
  const { data: branding } = useQuery({
    queryKey: ["public-branding"],
    queryFn: () => fetchBranding(),
    staleTime: 60_000,
  });

  // Hydrate from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved === "light" || saved === "dark") setThemeState(saved);
  }, []);

  // Apply theme class
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  // Apply accent override from branding
  useEffect(() => {
    if (typeof document === "undefined" || !branding) return;
    const root = document.documentElement;
    const color = theme === "dark" ? branding.accentDark : branding.accentLight;
    if (color) {
      root.style.setProperty("--accent", color);
      root.style.setProperty("--primary", color);
      root.style.setProperty("--ring", color);
      // For neon green in dark, foreground stays dark; for verde dark in light, foreground stays white
      root.style.setProperty(
        "--primary-foreground",
        theme === "dark" ? "#111111" : "#ffffff",
      );
      root.style.setProperty(
        "--accent-foreground",
        theme === "dark" ? "#111111" : "#ffffff",
      );
    }
  }, [branding, theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, t);
  };

  return (
    <ThemeCtx.Provider
      value={{
        theme,
        setTheme,
        toggle: () => setTheme(theme === "light" ? "dark" : "light"),
        branding: branding
          ? { brandName: branding.brandName, brandLogoUrl: branding.brandLogoUrl }
          : null,
      }}
    >
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
