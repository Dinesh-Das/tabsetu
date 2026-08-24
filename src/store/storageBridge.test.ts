import { describe, expect, it } from "vitest";
import { getDefaultStorageData } from "@/lib/storage";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { applyStorageDataToStores } from "@/store/storageBridge";
import type { Session } from "@/types";

function session(id: string): Session {
  return {
    id,
    name: id,
    description: "",
    folderId: null,
    tagIds: [],
    tabs: [],
    note: "",
    color: null,
    icon: null,
    openCount: 0,
    createdAt: 1,
    updatedAt: 1,
    lastOpenedAt: null,
    version: 1,
    isPinned: false,
    isArchived: false,
  };
}

describe("storageBridge", () => {
  it("refreshes only stores whose storage keys changed", () => {
    useSessionStore.getState().importSessions([session("existing")]);
    const data = {
      ...getDefaultStorageData(),
      sessions: [session("remote")],
      settings: { ...getDefaultStorageData().settings, theme: "dark" as const },
    };

    applyStorageDataToStores(data, new Set(["settings"]));
    expect(useSettingsStore.getState().settings.theme).toBe("dark");
    expect(useSessionStore.getState().sessions.map((item) => item.id)).toEqual(["existing"]);

    applyStorageDataToStores(data);
    expect(useSessionStore.getState().sessions.map((item) => item.id)).toEqual(["remote"]);
  });
});
