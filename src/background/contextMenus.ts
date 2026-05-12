import { createSessionFromWindow } from "@/background/messaging";
import { notifySessionCaptured } from "@/background/notifications";
import { storeBrowserTab } from "@/background/tabTracking";

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
