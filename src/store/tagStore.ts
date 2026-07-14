import { create } from "zustand";
import type { Tag } from "@/types";
import { loadStorage, saveTags } from "@/lib/storage";
import { useHydrationStore } from "@/store/hydration";
import { clampText, generateId, stripHtml } from "@/lib/tabHelpers";
import { PersistenceQueue } from "@/store/persistenceQueue";

interface TagState {
  tags: Tag[];
  load: () => Promise<void>;
  createTag: (name: string, color: string) => void;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  deleteTag: (id: string) => void;
  importTags: (tags: Tag[]) => void;
}

const persistenceQueue = new PersistenceQueue("tags");

function persistTags(tags: Tag[]): void {
  void persistenceQueue.enqueue(() => saveTags(tags));
}

function activeTags(tags: Tag[]): Tag[] {
  return tags.filter((tag) => tag.deletedAt == null);
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],

  load: async () => {
    const data = await loadStorage();
    set({ tags: activeTags(data.tags) });
    useHydrationStore.getState().markOneHydrated();
  },

  createTag: (name, color) => {
    const sanitizedName =
      clampText(stripHtml(name).replace(/[^a-zA-Z0-9\- ]/g, ""), 30) || "New Tag";
    const createdAt = Date.now();
    const tag: Tag = {
      id: generateId("tag"),
      name: sanitizedName,
      color,
      createdAt,
      updatedAt: createdAt,
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
    const tags = get().tags.map((t) =>
      t.id === id ? { ...t, ...sanitizedUpdates, updatedAt: Date.now() } : t
    );
    set({ tags });
    persistTags(tags);
  },

  deleteTag: (id) => {
    const target = get().tags.find((tag) => tag.id === id);
    if (!target) {
      return;
    }

    const tags = get().tags.filter((tag) => tag.id !== id);
    set({ tags });
    const deletedAt = Date.now();
    persistTags([...tags, { ...target, deletedAt, updatedAt: deletedAt }]);
  },

  importTags: (tags) => {
    set({ tags: activeTags(tags) });
  },
}));
