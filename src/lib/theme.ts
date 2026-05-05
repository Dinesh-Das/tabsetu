import type { Settings } from "@/types";

function resolveTheme(theme: Settings["theme"]): "light" | "dark" {
  if (theme !== "system") {
    return theme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Settings["theme"]): void {
  document.documentElement.className = resolveTheme(theme);
}

export function subscribeToSystemTheme(theme: Settings["theme"], onChange: () => void): () => void {
  if (theme !== "system") {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}
