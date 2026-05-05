import type { Session, TabItem } from "@/types";
import { sanitizeLabel } from "@/lib/tabHelpers";

const GENERATED_SESSION_NAME_PATTERN = /^(collapsed tabs|saved tabs|collapse|session)\b/i;

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

export function displaySessionTitle(session: Session): string {
  const sessionName = sanitizeLabel(session.name, "Untitled session", 100);
  return GENERATED_SESSION_NAME_PATTERN.test(sessionName)
    ? tabTitleFallback(session.tabs, sessionName)
    : sessionName;
}
