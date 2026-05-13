import { create } from "zustand";
import type { ShareLink } from "@/types";
import { loadStorage, saveShareLinks } from "@/lib/storage";
import { useHydrationStore } from "@/store/hydration";
import { generateId } from "@/lib/tabHelpers";

interface ShareState {
  shareLinks: ShareLink[];
  load: () => Promise<void>;
  createShareLink: (sessionId: string, encodedData: string) => ShareLink;
  importShareLinks: (shareLinks: ShareLink[]) => void;
}

let writePromise: Promise<void> = Promise.resolve();

function persistShareLinks(shareLinks: ShareLink[]): void {
  writePromise = writePromise.then(() => saveShareLinks(shareLinks));
  void writePromise;
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
    const shareLinks = [shareLink, ...get().shareLinks];
    set({ shareLinks });
    persistShareLinks(shareLinks);
    return shareLink;
  },

  importShareLinks: (shareLinks) => {
    set({ shareLinks: activeShareLinks(shareLinks) });
  },
}));
