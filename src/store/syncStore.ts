/**
 * Zustand state and actions for Google Drive appDataFolder synchronization.
 */
import { create } from "zustand";
import type { SyncState } from "@/types";
import {
  downloadSync,
  getLastSyncedAt,
  getSignedInEmail,
  GoogleDriveSyncError,
  hasSilentAuthToken,
  signIn as googleSignIn,
  signOut as googleSignOut,
  uploadSync,
} from "@/lib/googleSync";
import { loadStorage, registerAutoSyncUploadHandler, saveStorageData } from "@/lib/storage";
import { mergeStorageData } from "@/lib/syncMerge";
import { applyStorageDataToStores } from "@/store/storageBridge";

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

export const useSyncStore = create<SyncStore>((set, get) => ({
  enabled: false,
  email: null,
  lastSyncedAt: null,
  isSyncing: false,
  syncError: null,

  refreshStatus: async () => {
    try {
      const hasToken = await hasSilentAuthToken();
      if (!hasToken) {
        set({ enabled: false, email: null, lastSyncedAt: null, syncError: null });
        return;
      }

      const [email, lastSyncedAt] = await Promise.all([getSignedInEmail(), getLastSyncedAt()]);
      set({ enabled: true, email, lastSyncedAt, syncError: null });
    } catch (error) {
      set({ syncError: syncErrorMessage(error) });
    }
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
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const local = await loadStorage({ includeDeleted: true });
        const remote = await downloadSync();
        const data = remote
          ? mergeStorageData(local, remote.data, {
              mergeSettings: true,
              includeDeleted: true,
            })
          : local;
        if (remote) {
          await saveStorageData(data, { scheduleSync: false });
          applyStorageDataToStores(data);
        }

        try {
          await uploadSync(data, {
            expectedRemote: remote
              ? { fileId: remote.fileId, etag: remote.etag, version: remote.version }
              : null,
          });
          break;
        } catch (error) {
          if (error instanceof GoogleDriveSyncError && error.isConflict && attempt === 0) {
            continue;
          }
          throw error;
        }
      }
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
        const merged = mergeStorageData(local, remote.data, {
          mergeSettings: true,
          includeDeleted: true,
        });
        await saveStorageData(merged, { scheduleSync: false });
        applyStorageDataToStores(merged);
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
