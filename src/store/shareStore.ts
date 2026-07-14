import { create } from "zustand";
import type { ShareLink } from "@/types";
import { loadStorage, saveShareLinks } from "@/lib/storage";
import { useHydrationStore } from "@/store/hydration";
import { generateId } from "@/lib/tabHelpers";
import { PersistenceQueue } from "@/store/persistenceQueue";

interface ShareState {
  shareLinks: ShareLink[];
  load: () => Promise<void>;
  createShareLink: (sessionId: string, encodedData: string) => ShareLink;
  clearShareLinks: () => void;
  importShareLinks: (shareLinks: ShareLink[]) => void;
}

const persistenceQueue = new PersistenceQueue("share links");

function persistShareLinks(shareLinks: ShareLink[]): void {
  void persistenceQueue.enqueue(() => saveShareLinks(shareLinks));
}

function activeShareLinks(shareLinks: ShareLink[]): ShareLink[] {
  return shareLinks.filter((shareLink) => shareLink.deletedAt == null);
}

export const useShareStore = create<ShareState>((set, get) => ({
  shareLinks: [],

  load: async () => {
    const data = await loadStorage();
    set({ shareLinks: activeShareLinks(data.shareLinks) });
    useHydrationStore.getState().markOneHydrated();
  },

  createShareLink: (sessionId, encodedData) => {
    const createdAt = Date.now();
    const shareLink: ShareLink = {
      id: generateId("share"),
      sessionId,
      type: "encoded-url",
      encodedData,
      expiresAt: null,
      createdAt,
      updatedAt: createdAt,
    };
    const replacedLinks = get().shareLinks.filter((link) => link.sessionId === sessionId);
    const shareLinks = [
      shareLink,
      ...get().shareLinks.filter((link) => link.sessionId !== sessionId),
    ];
    set({ shareLinks });
    persistShareLinks([
      ...shareLinks,
      ...replacedLinks.map((link) => ({ ...link, deletedAt: createdAt, updatedAt: createdAt })),
    ]);
    return shareLink;
  },

  clearShareLinks: () => {
    const deletedAt = Date.now();
    const tombstones = get().shareLinks.map((link) => ({
      ...link,
      deletedAt,
      updatedAt: deletedAt,
    }));
    set({ shareLinks: [] });
    persistShareLinks(tombstones);
  },

  importShareLinks: (shareLinks) => {
    set({ shareLinks: activeShareLinks(shareLinks) });
  },
}));
