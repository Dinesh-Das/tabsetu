/* eslint-disable @typescript-eslint/unbound-method */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, STORAGE_KEYS } from "@/lib/storage";
import { useSettingsStore } from "@/store/settingsStore";
import type { Settings } from "@/types";

describe("settings persistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(chrome.storage.sync.set).mockClear();
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS } });
  });

  afterEach(() => {
    window.dispatchEvent(new Event("pagehide"));
    vi.useRealTimers();
  });

  it("coalesces rapid setting changes into one browser-sync write", async () => {
    const store = useSettingsStore.getState();
    store.updateSettings({ customAIPromptTemplate: "a" });
    store.updateSettings({ customAIPromptTemplate: "ab" });
    store.updateSettings({ customAIPromptTemplate: "abc" });

    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600);
    await Promise.resolve();

    expect(chrome.storage.sync.set).toHaveBeenCalledTimes(1);
    const [items] = vi.mocked(chrome.storage.sync.set).mock.calls[0] ?? [];
    const saved = (items as Record<string, unknown>)[STORAGE_KEYS.settings] as Settings;
    expect(saved.customAIPromptTemplate).toBe("abc");
  });
});
