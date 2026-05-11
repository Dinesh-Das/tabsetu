import { create } from "zustand";
import type { StorageData } from "@/types";
import { loadSettings, loadStorage } from "@/lib/storage";

const TOTAL_STORES = 7;

interface HydrationState {
  hydratedCount: number;
  isReady: boolean;
  markOneHydrated: () => void;
}

export const useHydrationStore = create<HydrationState>((set, get) => ({
  hydratedCount: 0,
  isReady: false,
  markOneHydrated: () => {
    const next = get().hydratedCount + 1;
    set({ hydratedCount: next, isReady: next >= TOTAL_STORES });
  },
}));

export async function loadHydratedStorage(): Promise<StorageData> {
  const [data, settings] = await Promise.all([loadStorage(), loadSettings()]);
  return { ...data, settings };
}
