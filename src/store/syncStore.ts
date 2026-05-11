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
import { loadStorage, saveStorageData } from "@/lib/storage";
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
  useSessionStore.getState().importSessions(data.sessions);
  useFolderStore.getState().importFolders(data.folders);
  useTagStore.getState().importTags(data.tags);
  useScheduleStore.getState().importSchedules(data.schedules);
  useNotesStore.getState().importNotes(data.standaloneNotes);
  useShareStore.getState().importShareLinks(data.shareLinks);
  useSettingsStore.getState().replaceSettings(data.settings);
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
      const data = await loadStorage();
      await uploadSync(data);
      const lastSyncedAt = (await getLastSyncedAt()) ?? Date.now();
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
        const local = await loadStorage();
        const merged = mergeStorageData(local, remote);
        await saveStorageData(merged);
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
