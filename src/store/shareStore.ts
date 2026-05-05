import { create } from "zustand";
import type { ShareLink } from "@/types";
import { loadStorage, saveShareLinks } from "@/lib/storage";
import { generateId } from "@/lib/tabHelpers";

interface ShareState {
  shareLinks: ShareLink[];
  load: () => Promise<void>;
  createShareLink: (sessionId: string, encodedData: string) => ShareLink;
  importShareLinks: (shareLinks: ShareLink[]) => void;
}

function persistShareLinks(shareLinks: ShareLink[]): void {
  void saveShareLinks(shareLinks);
}

export const useShareStore = create<ShareState>((set, get) => ({
  shareLinks: [],

  load: async () => {
    const data = await loadStorage();
    set({ shareLinks: data.shareLinks });
  },

  createShareLink: (sessionId, encodedData) => {
    const createdAt = Date.now();
    const shareLink: ShareLink = {
      id: generateId("share"),
      sessionId,
      type: "encoded-url",
      encodedData,
      hostedUrl: null,
      slug: null,
      expiresAt: null,
      viewCount: 0,
      createdAt,
      updatedAt: createdAt,
    };
    const shareLinks = [shareLink, ...get().shareLinks];
    set({ shareLinks });
    persistShareLinks(shareLinks);
    return shareLink;
  },

  importShareLinks: (shareLinks) => {
    set({ shareLinks });
    persistShareLinks(shareLinks);
  },
}));
