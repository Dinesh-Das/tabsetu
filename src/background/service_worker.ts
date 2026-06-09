import { hydrateAlarms, maybeStartKeepalive, registerAlarmListeners } from "@/background/alarms";
import { registerContextMenuListeners, registerContextMenus } from "@/background/contextMenus";
import { registerMessagingListeners } from "@/background/messaging";
import {
  notifyUnassignedCommandShortcuts,
  registerNotificationListeners,
  updateBadge,
} from "@/background/notifications";
import { findFallbackBrowserTab, registerTabTrackingListeners } from "@/background/tabTracking";
import {
  flushPendingAutoSyncUpload,
  initializeStorageForInstall,
  loadStorage,
  migrateSettingsToSync,
} from "@/lib/storage";
import { useSyncStore } from "@/store/syncStore";

registerTabTrackingListeners();
registerAlarmListeners();
registerMessagingListeners();
registerContextMenuListeners();
registerNotificationListeners();

async function refreshSyncAndBootstrapTabs(): Promise<void> {
  await useSyncStore.getState().refreshStatus();
  if (useSyncStore.getState().enabled) {
    await useSyncStore.getState().pullNow();
  }
  await updateBadge();
  await findFallbackBrowserTab();
  await notifyUnassignedCommandShortcuts();
}

chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    if (details.reason === "install") {
      await initializeStorageForInstall();
    } else {
      await migrateSettingsToSync();
      await loadStorage();
    }

    registerContextMenus();
    await hydrateAlarms();
    await refreshSyncAndBootstrapTabs();
  })();
});

chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    await hydrateAlarms();
    await refreshSyncAndBootstrapTabs();
  })();
});

chrome.runtime.onSuspend?.addListener(() => {
  void (async () => {
    await useSyncStore.getState().refreshStatus();
    await flushPendingAutoSyncUpload();
  })();
});

void maybeStartKeepalive();
