import { create } from "zustand";
import type { Tag } from "@/types";
import { loadStorage, saveTags } from "@/lib/storage";
import { useHydrationStore } from "@/store/hydration";
import { clampText, generateId, stripHtml } from "@/lib/tabHelpers";

interface TagState {
  tags: Tag[];
  load: () => Promise<void>;
  createTag: (name: string, color: string) => void;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  deleteTag: (id: string) => void;
  importTags: (tags: Tag[]) => void;
}

let writePromise: Promise<void> = Promise.resolve();

function persistTags(tags: Tag[]): void {
  writePromise = writePromise.then(() => saveTags(tags));
  void writePromise;
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],

  load: async () => {
    const data = await loadStorage();
    set({ tags: data.tags });
    useHydrationStore.getState().markOneHydrated();
  },

  createTag: (name, color) => {
    const sanitizedName =
      clampText(stripHtml(name).replace(/[^a-zA-Z0-9\- ]/g, ""), 30) || "New Tag";
    const tag: Tag = {
      id: generateId("tag"),
      name: sanitizedName,
      color,
      createdAt: Date.now(),
    };
    const tags = [...get().tags, tag];
    set({ tags });
    persistTags(tags);
  },

  updateTag: (id, updates) => {
    const sanitizedUpdates = {
      ...updates,
      ...(typeof updates.name === "string"
        ? { name: clampText(stripHtml(updates.name).replace(/[^a-zA-Z0-9\- ]/g, ""), 30) || "Tag" }
        : {}),
    };
    const tags = get().tags.map((t) => (t.id === id ? { ...t, ...sanitizedUpdates } : t));
    set({ tags });
    persistTags(tags);
  },

  deleteTag: (id) => {
    const tags = get().tags.filter((t) => t.id !== id);
    set({ tags });
    persistTags(tags);
  },

  importTags: (tags) => {
    set({ tags });
  },
}));
