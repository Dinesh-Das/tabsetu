import { create } from 'zustand';
import type { Settings } from '@/types';
import { loadStorage, saveSettings } from '@/lib/storage';

interface SettingsState {
  settings: Settings;
  load: () => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {
    theme: 'dark',
    collapseIncludesPinned: false,
    openInNewWindow: false,
    confirmBeforeDelete: true,
    schedulesEnabled: true,
    dashboardLayout: 'split',
    sessionCardStyle: 'comfortable',
    searchScopes: {
      sessions: true,
      tabs: true,
      notes: true,
      tags: true,
      folders: true,
    },
    fuzzySearchThreshold: 0.32,
    autoArchiveDays: null,
  },

  load: async () => {
    const data = await loadStorage();
    set({ settings: data.settings });
  },

  updateSettings: (updates) => {
    const settings = { ...get().settings, ...updates };
    set({ settings });
    saveSettings(settings);
  },
}));
