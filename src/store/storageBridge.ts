import type { StorageData } from "@/types";
import { hideDeletedStorageData, loadStorage, STORAGE_KEYS } from "@/lib/storage";
import { useFolderStore } from "@/store/folderStore";
import { useNotesStore } from "@/store/notesStore";
import { useScheduleStore } from "@/store/scheduleStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useShareStore } from "@/store/shareStore";
import { useTagStore } from "@/store/tagStore";

const RELEVANT_KEYS = new Set<string>([
  STORAGE_KEYS.sessions,
  STORAGE_KEYS.folders,
  STORAGE_KEYS.tags,
  STORAGE_KEYS.schedules,
  STORAGE_KEYS.standaloneNotes,
  STORAGE_KEYS.shareLinks,
  STORAGE_KEYS.aiConfig,
  STORAGE_KEYS.settings,
  STORAGE_KEYS.schemaVersion,
]);

type StoreTarget =
  | "sessions"
  | "folders"
  | "tags"
  | "schedules"
  | "standaloneNotes"
  | "shareLinks"
  | "settings";

function isRelevantStorageKey(key: string): boolean {
  return RELEVANT_KEYS.has(key) || key.startsWith(STORAGE_KEYS.sessionsChunkPrefix);
}

function storeTargetForKey(key: string): StoreTarget | null {
  if (key === STORAGE_KEYS.sessions || key.startsWith(STORAGE_KEYS.sessionsChunkPrefix)) {
    return "sessions";
  }
  if (key === STORAGE_KEYS.folders) return "folders";
  if (key === STORAGE_KEYS.tags) return "tags";
  if (key === STORAGE_KEYS.schedules) return "schedules";
  if (key === STORAGE_KEYS.standaloneNotes) return "standaloneNotes";
  if (key === STORAGE_KEYS.shareLinks) return "shareLinks";
  if (key === STORAGE_KEYS.settings) return "settings";
  return null;
}

export function applyStorageDataToStores(data: StorageData, targets?: Set<StoreTarget>): void {
  const visibleData = hideDeletedStorageData(data);
  const includes = (target: StoreTarget): boolean => !targets || targets.has(target);
  if (includes("sessions")) useSessionStore.getState().importSessions(visibleData.sessions);
  if (includes("folders")) useFolderStore.getState().importFolders(visibleData.folders);
  if (includes("tags")) useTagStore.getState().importTags(visibleData.tags);
  if (includes("schedules")) useScheduleStore.getState().importSchedules(visibleData.schedules);
  if (includes("standaloneNotes")) {
    useNotesStore.getState().importNotes(visibleData.standaloneNotes);
  }
  if (includes("shareLinks")) useShareStore.getState().importShareLinks(visibleData.shareLinks);
  if (includes("settings")) useSettingsStore.getState().replaceSettings(visibleData.settings);
}

/** Keep a mounted popup/dashboard in sync with writes from other extension contexts. */
export function subscribeToStorageBridge(onError?: (error: unknown) => void): () => void {
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let refreshInFlight = false;
  let refreshQueued = false;
  let stopped = false;
  const pendingTargets = new Set<StoreTarget>();

  const refresh = async (): Promise<void> => {
    if (refreshInFlight) {
      refreshQueued = true;
      return;
    }

    refreshInFlight = true;
    const targets = new Set(pendingTargets);
    pendingTargets.clear();
    try {
      if (targets.size > 0) {
        applyStorageDataToStores(await loadStorage(), targets);
      }
    } catch (error) {
      onError?.(error);
    } finally {
      refreshInFlight = false;
      if (refreshQueued && !stopped) {
        refreshQueued = false;
        void refresh();
      }
    }
  };

  const listener = (changes: Record<string, chrome.storage.StorageChange>): void => {
    const changedKeys = Object.keys(changes);
    if (!changedKeys.some(isRelevantStorageKey)) return;
    for (const key of changedKeys) {
      const target = storeTargetForKey(key);
      if (target) pendingTargets.add(target);
    }
    if (pendingTargets.size === 0) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      void refresh();
    }, 120);
  };

  chrome.storage.onChanged.addListener(listener);
  return () => {
    stopped = true;
    if (refreshTimer) clearTimeout(refreshTimer);
    chrome.storage.onChanged.removeListener(listener);
  };
}
