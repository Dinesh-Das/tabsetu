/**
 * Zustand state and actions for Google Drive appDataFolder synchronization.
 */
import { create } from "zustand";
import type { SyncState } from "@/types";
import {
  downloadSync,
  getLastSyncedAt,
  getSignedInEmail,
  hasSilentAuthToken,
  signIn as googleSignIn,
  signOut as googleSignOut,
  uploadSync,
} from "@/lib/googleSync";
import {
  hideDeletedStorageData,
  loadStorage,
  registerAutoSyncUploadHandler,
  saveStorageData,
} from "@/lib/storage";
import { mergeStorageData } from "@/lib/syncMerge";
import { useFolderStore } from "@/store/folderStore";
import { useNotesStore } from "@/store/notesStore";
import { useScheduleStore } from "@/store/scheduleStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useShareStore } from "@/store/shareStore";
import { useTagStore } from "@/store/tagStore";

interface SyncStore extends SyncState {
  refreshStatus: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  pullNow: () => Promise<void>;
}

function syncErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Sync failed. Please try again.";
}

function reloadStoresFromStorage(data: Awaited<ReturnType<typeof loadStorage>>): void {
  const visibleData = hideDeletedStorageData(data);
  useSessionStore.getState().importSessions(visibleData.sessions);
  useFolderStore.getState().importFolders(visibleData.folders);
  useTagStore.getState().importTags(visibleData.tags);
  useScheduleStore.getState().importSchedules(visibleData.schedules);
  useNotesStore.getState().importNotes(visibleData.standaloneNotes);
  useShareStore.getState().importShareLinks(visibleData.shareLinks);
  useSettingsStore.getState().replaceSettings(visibleData.settings);
}

export const useSyncStore = create<SyncStore>((set, get) => ({
  enabled: false,
  email: null,
  lastSyncedAt: null,
  isSyncing: false,
  syncError: null,

  refreshStatus: async () => {
    const hasToken = await hasSilentAuthToken();
    if (!hasToken) {
      set({ enabled: false, email: null, lastSyncedAt: null, syncError: null });
      return;
    }

    const [email, lastSyncedAt] = await Promise.all([getSignedInEmail(), getLastSyncedAt()]);
    set({ enabled: true, email, lastSyncedAt, syncError: null });
  },

  signIn: async () => {
    set({ isSyncing: true, syncError: null });
    try {
      const token = await googleSignIn();
      if (!token) {
        set({
          enabled: false,
          email: null,
          syncError: "Google sign-in could not be completed. Check the OAuth client setup.",
        });
        return;
      }

      const [email, lastSyncedAt] = await Promise.all([getSignedInEmail(), getLastSyncedAt()]);
      set({ enabled: true, email, lastSyncedAt, isSyncing: false, syncError: null });
      await get().pullNow();
    } catch (error) {
      set({ syncError: syncErrorMessage(error) });
    } finally {
      set({ isSyncing: false });
    }
  },

  signOut: async () => {
    await googleSignOut();
    set({
      enabled: false,
      email: null,
      lastSyncedAt: null,
      isSyncing: false,
      syncError: null,
    });
  },

  syncNow: async () => {
    if (get().isSyncing) {
      return;
    }

    set({ isSyncing: true, syncError: null });
    try {
      const local = await loadStorage({ includeDeleted: true });
      const remote = await downloadSync();
      const data = remote
        ? mergeStorageData(local, remote, { mergeSettings: true, includeDeleted: true })
        : local;
      if (remote) {
        await saveStorageData(data, { scheduleSync: false });
        reloadStoresFromStorage(data);
      }
      await uploadSync(data);
      const lastSyncedAt = await getLastSyncedAt();
      if (lastSyncedAt == null) {
        throw new Error("Google Drive did not confirm the uploaded sync file.");
      }
      set({ lastSyncedAt, syncError: null });
    } catch (error) {
      set({ syncError: syncErrorMessage(error) });
    } finally {
      set({ isSyncing: false });
    }
  },

  pullNow: async () => {
    if (get().isSyncing) {
      return;
    }

    set({ isSyncing: true, syncError: null });
    try {
      const remote = await downloadSync();
      if (remote) {
        const local = await loadStorage({ includeDeleted: true });
        const merged = mergeStorageData(local, remote, {
          mergeSettings: true,
          includeDeleted: true,
        });
        await saveStorageData(merged, { scheduleSync: false });
        reloadStoresFromStorage(merged);
      }
      const lastSyncedAt = (await getLastSyncedAt()) ?? get().lastSyncedAt ?? null;
      set({ lastSyncedAt, syncError: null });
    } catch (error) {
      set({ syncError: syncErrorMessage(error) });
    } finally {
      set({ isSyncing: false });
    }
  },
}));

registerAutoSyncUploadHandler(async () => {
  const { enabled, syncNow } = useSyncStore.getState();
  if (enabled) {
    await syncNow();
  }
});
