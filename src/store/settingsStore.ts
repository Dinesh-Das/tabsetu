import { create } from "zustand";
import type { Settings } from "@/types";
import { DEFAULT_SETTINGS, loadSettings, saveSettingsPatch } from "@/lib/storage";
import { useHydrationStore } from "@/store/hydration";
import { PersistenceQueue } from "@/store/persistenceQueue";

interface SettingsState {
  settings: Settings;
  load: () => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => void;
  replaceSettings: (settings: Settings) => void;
}

const persistenceQueue = new PersistenceQueue("settings");
const SETTINGS_PERSIST_DEBOUNCE_MS = 600;
let pendingSettingsPatch: Partial<Settings> | null = null;
let persistenceTimer: ReturnType<typeof setTimeout> | null = null;

function flushSettingsPersistence(): void {
  if (persistenceTimer) {
    clearTimeout(persistenceTimer);
    persistenceTimer = null;
  }
  const updates = pendingSettingsPatch;
  pendingSettingsPatch = null;
  if (updates) {
    void persistenceQueue.enqueue(() => saveSettingsPatch(updates));
  }
}

function persistSettings(updates: Partial<Settings>): void {
  pendingSettingsPatch = { ...pendingSettingsPatch, ...updates };
  if (persistenceTimer) clearTimeout(persistenceTimer);
  persistenceTimer = setTimeout(flushSettingsPersistence, SETTINGS_PERSIST_DEBOUNCE_MS);
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
    persistSettings({ ...updates, updatedAt: settings.updatedAt });
  },

  replaceSettings: (settings) => {
    set({ settings });
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushSettingsPersistence);
}
