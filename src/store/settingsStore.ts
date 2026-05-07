import { create } from 'zustand';
import type { Settings } from '@/types';
import { DEFAULT_SETTINGS, loadStorage, saveSettings } from '@/lib/storage';

interface SettingsState {
  settings: Settings;
  load: () => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => void;
}

let writePromise: Promise<void> = Promise.resolve();

function persistSettings(settings: Settings): void {
  writePromise = writePromise.then(() => saveSettings(settings));
  void writePromise;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,

  load: async () => {
    const data = await loadStorage();
    set({ settings: data.settings });
  },

  updateSettings: (updates) => {
    const settings = { ...get().settings, ...updates };
    set({ settings });
    persistSettings(settings);
  },
}));
