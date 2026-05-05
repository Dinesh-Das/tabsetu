import { create } from 'zustand';
import type { Tag } from '@/types';
import { loadStorage, saveTags } from '@/lib/storage';
import { clampText, generateId, stripHtml } from '@/lib/tabHelpers';

interface TagState {
  tags: Tag[];
  load: () => Promise<void>;
  createTag: (name: string, color: string) => void;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  deleteTag: (id: string) => void;
  importTags: (tags: Tag[]) => void;
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],

  load: async () => {
    const data = await loadStorage();
    set({ tags: data.tags });
  },

  createTag: (name, color) => {
    const sanitizedName = clampText(stripHtml(name).replace(/[^a-zA-Z0-9\- ]/g, ""), 30) || "New Tag";
    const tag: Tag = {
      id: generateId('tag'),
      name: sanitizedName,
      color,
      createdAt: Date.now(),
    };
    const tags = [...get().tags, tag];
    set({ tags });
    void saveTags(tags);
  },

  updateTag: (id, updates) => {
    const sanitizedUpdates = {
      ...updates,
      ...(typeof updates.name === "string"
        ? { name: clampText(stripHtml(updates.name).replace(/[^a-zA-Z0-9\- ]/g, ""), 30) || "Tag" }
        : {}),
    };
    const tags = get().tags.map((t) =>
      t.id === id ? { ...t, ...sanitizedUpdates } : t
    );
    set({ tags });
    void saveTags(tags);
  },

  deleteTag: (id) => {
    const tags = get().tags.filter((t) => t.id !== id);
    set({ tags });
    void saveTags(tags);
  },

  importTags: (tags) => {
    set({ tags });
    void saveTags(tags);
  },
}));
