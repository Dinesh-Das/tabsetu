import type { TabItem } from "@/types";
import { sanitizeLabel } from "@/lib/tabHelpers";

function tabTitleFallback(tabs: TabItem[], fallback: string): string {
  const firstTab = tabs[0];
  if (!firstTab) {
    return fallback;
  }

  const firstTitle = sanitizeLabel(firstTab.title, fallback, 100);
  const extraTabCount = tabs.length - 1;
  const tabNoun = extraTabCount === 1 ? "tab" : "tabs";
  return extraTabCount === 0 ? firstTitle : `${firstTitle} + ${extraTabCount} ${tabNoun}`;
}

export function defaultSavedSessionTitle(closeAfterSaving: boolean, tabs: TabItem[]): string {
  const fallback = closeAfterSaving ? "Collapsed tabs" : "Saved tabs";
  return tabTitleFallback(tabs, fallback);
}
