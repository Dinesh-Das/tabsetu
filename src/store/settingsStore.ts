import { create } from "zustand";
import type { Settings } from "@/types";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, STORAGE_KEYS } from "@/lib/storage";
import { useHydrationStore } from "@/store/hydration";

interface SettingsState {
  settings: Settings;
  load: () => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => void;
  replaceSettings: (settings: Settings) => void;
}

let writePromise: Promise<void> = Promise.resolve();

function persistSettings(settings: Settings): void {
  writePromise = writePromise.then(() => saveSettings(settings));
  void writePromise;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,

  load: async () => {
    const settings = await loadSettings();
    set({ settings });
    useHydrationStore.getState().markOneHydrated();
  },

  updateSettings: (updates) => {
    const settings = { ...get().settings, ...updates, updatedAt: Date.now() };
    set({ settings });
    persistSettings(settings);
  },

  replaceSettings: (settings) => {
    set({ settings });
  },
}));

if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") {
      return;
    }

    const change = changes[STORAGE_KEYS.settings];
    if (!change?.newValue) {
      return;
    }

    useSettingsStore.getState().replaceSettings(change.newValue as Settings);
  });
}
