import { create } from 'zustand';
import type { Tag } from '@/types';
import { loadStorage, saveTags } from '@/lib/storage';
import { generateId } from '@/lib/tabHelpers';

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
    const tag: Tag = {
      id: generateId('tag'),
      name: name.trim() || 'New Tag',
      color,
      createdAt: Date.now(),
    };
    const tags = [...get().tags, tag];
    set({ tags });
    saveTags(tags);
  },

  updateTag: (id, updates) => {
    const tags = get().tags.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    );
    set({ tags });
    saveTags(tags);
  },

  deleteTag: (id) => {
    const tags = get().tags.filter((t) => t.id !== id);
    set({ tags });
    saveTags(tags);
  },

  importTags: (tags) => {
    set({ tags });
    saveTags(tags);
  },
}));
