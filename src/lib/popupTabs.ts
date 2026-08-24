import { isRestrictedUrl, isValidUrl } from "@/lib/tabHelpers";

export function isCapturableChromeTab(tab: chrome.tabs.Tab): boolean {
  return Boolean(!tab.incognito && tab.url && !isRestrictedUrl(tab.url) && isValidUrl(tab.url));
}

export function filterCapturableTabs(tabs: chrome.tabs.Tab[], query = ""): chrome.tabs.Tab[] {
  const normalizedQuery = query.trim().toLowerCase();

  return tabs.filter((tab) => {
    if (!isCapturableChromeTab(tab)) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return (
      tab.title?.toLowerCase().includes(normalizedQuery) ||
      tab.url?.toLowerCase().includes(normalizedQuery)
    );
  });
}

export function countSelectedVisibleTabs(tabs: chrome.tabs.Tab[], selectedIds: number[]): number {
  const visibleIds = new Set(
    filterCapturableTabs(tabs)
      .map((tab) => tab.id)
      .filter((id): id is number => typeof id === "number")
  );

  return selectedIds.filter((id) => visibleIds.has(id)).length;
}
