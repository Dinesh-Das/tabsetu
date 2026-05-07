import { create } from 'zustand';
import type { Folder } from '@/types';
import { loadStorage, saveFolders } from '@/lib/storage';
import { generateId, sanitizeLabel } from '@/lib/tabHelpers';

interface FolderState {
  folders: Folder[];
  load: () => Promise<void>;
  createFolder: (name: string, color: string, icon: string) => void;
  updateFolder: (id: string, updates: Partial<Folder>) => void;
  deleteFolder: (id: string) => void;
  importFolders: (folders: Folder[]) => void;
}

let writePromise: Promise<void> = Promise.resolve();

function persistFolders(folders: Folder[]): void {
  writePromise = writePromise.then(() => saveFolders(folders));
  void writePromise;
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folders: [],

  load: async () => {
    const data = await loadStorage();
    set({ folders: data.folders });
  },

  createFolder: (name, color, icon) => {
    const position = get().folders.length;
    const folder: Folder = {
      id: generateId('folder'),
      name: sanitizeLabel(name, 'New Folder', 50),
      color,
      icon,
      position,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const folders = [...get().folders, folder];
    set({ folders });
    persistFolders(folders);
  },

  updateFolder: (id, updates) => {
    const sanitizedUpdates = {
      ...updates,
      ...(typeof updates.name === "string" ? { name: sanitizeLabel(updates.name, "Folder", 50) } : {}),
    };
    const folders = get().folders.map((f) =>
      f.id === id ? { ...f, ...sanitizedUpdates, updatedAt: Date.now() } : f
    );
    set({ folders });
    persistFolders(folders);
  },

  deleteFolder: (id) => {
    const folders = get().folders.filter((f) => f.id !== id);
    set({ folders });
    persistFolders(folders);
  },

  importFolders: (folders) => {
    const normalizedFolders = [...folders]
      .sort((left, right) => left.position - right.position)
      .map((folder, index) => ({ ...folder, position: index }));
    set({ folders: normalizedFolders });
  },
}));
