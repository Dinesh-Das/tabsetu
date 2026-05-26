import { createSessionFromWindow } from "@/background/messaging";
import { notifyCommandProblem, notifySessionCaptured } from "@/background/notifications";
import { storeBrowserTab } from "@/background/tabTracking";
import { defaultSavedSessionTitle } from "@/lib/sessionLabels";
import { loadStorage, saveSessions } from "@/lib/storage";
import { generateId, isRestrictedUrl, isValidUrl, sanitizeLabel } from "@/lib/tabHelpers";
import type { Session, TabItem } from "@/types";

function contextMenuUrl(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): string | null {
  const rawUrl = info.linkUrl ?? info.pageUrl ?? tab?.url;
  if (!rawUrl || !isValidUrl(rawUrl) || isRestrictedUrl(rawUrl)) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function contextMenuTitle(url: string, tab?: chrome.tabs.Tab): string {
  if (tab?.url === url && tab.title) {
    return sanitizeLabel(tab.title, "Saved tab", 200);
  }

  try {
    return sanitizeLabel(new URL(url).hostname.replace(/^www\./i, ""), "Saved link", 200);
  } catch {
    return "Saved link";
  }
}

async function createSessionFromContextItem(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): Promise<Session | null> {
  const url = contextMenuUrl(info, tab);
  if (!url) {
    await notifyCommandProblem(
      "TabSetu could not save this item",
      "Only regular http and https pages or links can be saved."
    );
    return null;
  }

  const createdAt = Date.now();
  const savedTab: TabItem = {
    id: generateId("tab"),
    title: contextMenuTitle(url, tab),
    url,
    favIconUrl: tab?.url === url ? (tab.favIconUrl ?? null) : null,
    folderId: null,
    tagIds: [],
    pinned: tab?.url === url ? (tab.pinned ?? false) : false,
    windowId: tab?.windowId ?? null,
    note: "",
    reminderAt: null,
    reminderSnoozedUntil: null,
    reminderDismissed: false,
    position: 0,
    openCount: 0,
    createdAt,
    lastOpenedAt: null,
  };
  const session: Session = {
    id: generateId("session"),
    name: defaultSavedSessionTitle(false, [savedTab]),
    description: "Saved from the browser context menu.",
    folderId: null,
    tagIds: [],
    tabs: [savedTab],
    note: "",
    color: null,
    icon: null,
    openCount: 0,
    createdAt,
    updatedAt: createdAt,
    lastOpenedAt: null,
    version: 1,
    isPinned: false,
    isArchived: false,
  };
  const { sessions } = await loadStorage();
  await saveSessions([session, ...sessions]);
  return session;
}

export function registerContextMenus(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "tabsetu-save-tab",
      title: "Save tab to TabSetu",
      contexts: ["page", "link"],
    });
    chrome.contextMenus.create({
      id: "tabsetu-save-window",
      title: "Save window as TabSetu session",
      contexts: ["page"],
    });
  });
}

export function registerContextMenuListeners(): void {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "tabsetu-save-tab" && tab) {
      void storeBrowserTab(tab);
      void createSessionFromContextItem(info, tab).then((session) => {
        if (session) {
          void notifySessionCaptured({ session, tabCount: 1, mode: "save" });
        }
      });
    }

    if (info.menuItemId === "tabsetu-save-window") {
      void createSessionFromWindow("save").then((result) => {
        if (result) {
          void notifySessionCaptured(result);
        }
      });
    }
  });
}
