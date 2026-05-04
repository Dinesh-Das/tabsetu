import type { Session, TabItem } from "@/types";
import { isRestrictedUrl } from "@/lib/tabHelpers";

export function getOpenableTabs(tabs: TabItem[]): TabItem[] {
  return tabs.filter((tab) => tab.url && !isRestrictedUrl(tab.url));
}

export async function openSavedTab(tab: TabItem, openInNewWindow = false): Promise<boolean> {
  if (!tab.url || isRestrictedUrl(tab.url)) {
    return false;
  }

  if (openInNewWindow) {
    await chrome.windows.create({ url: tab.url, focused: true });
  } else {
    await chrome.tabs.create({ url: tab.url });
  }

  return true;
}

export async function openSessionTabs(session: Session, openInNewWindow: boolean): Promise<number> {
  const openableTabs = getOpenableTabs(session.tabs);
  const urls = openableTabs.map((tab) => tab.url);

  if (urls.length === 0) {
    return 0;
  }

  if (openInNewWindow) {
    const newWindow = await chrome.windows.create({ url: urls[0], focused: true });
    for (const url of urls.slice(1)) {
      await chrome.tabs.create({ windowId: newWindow.id, url });
    }
  } else {
    for (const url of urls) {
      await chrome.tabs.create({ url });
    }
  }

  return urls.length;
}

export function getDomainLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function copyTextToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
