import { describe, expect, it } from "vitest";
import sourceManifest from "@/manifest.json";
import {
  DEFAULT_SETTINGS,
  getDefaultStorageData,
  loadStorage,
  loadSettings,
  mergeLatestEntities,
  normalizeImportedStorageData,
  prepareStorageReplacement,
  saveSessions,
  saveSettingsPatch,
} from "@/lib/storage";
import type { Folder, Session } from "@/types";

function folder(id: string, updatedAt: number, deletedAt?: number): Folder {
  return {
    id,
    name: id,
    color: "#000000",
    icon: "folder",
    position: 0,
    createdAt: 1,
    updatedAt,
    ...(deletedAt == null ? {} : { deletedAt }),
  };
}

function session(id: string, updatedAt: number): Session {
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
    updatedAt,
    lastOpenedAt: null,
    version: 1,
    isPinned: false,
    isArchived: false,
  };
}

describe("normalizeImportedStorageData", () => {
  it("uses the manifest version for default settings", () => {
    expect(DEFAULT_SETTINGS.version).toBe(sourceManifest.version);
    expect(normalizeImportedStorageData({ sessions: [] }).settings.version).toBe(
      sourceManifest.version
    );
  });

  it("keeps browser history search off by default", () => {
    expect(DEFAULT_SETTINGS.browserHistorySearchEnabled).toBe(false);
    expect(DEFAULT_SETTINGS.searchScopes.browserHistory).toBe(false);
    expect(
      normalizeImportedStorageData({ sessions: [] }).settings.browserHistorySearchEnabled
    ).toBe(false);
  });

  it("keeps AI prompt sharing off by default", () => {
    expect(DEFAULT_SETTINGS.aiEnabled).toBe(false);
  });

  it("bounds settings stored in browser sync", () => {
    const result = normalizeImportedStorageData({
      settings: {
        customAIProviderUrl: `https://example.com/${"u".repeat(3000)}`,
        customAIPromptTemplate: "p".repeat(5000),
      },
    });

    expect(result.settings.customAIProviderUrl.length).toBe(2048);
    expect(result.settings.customAIPromptTemplate.length).toBe(4000);
  });

  it("reindexes positions and normalizes imported entities", () => {
    const result = normalizeImportedStorageData({
      folders: [
        {
          id: "folder-b",
          name: "Backlog",
          color: "#10B981",
          icon: "Backlog",
          position: 8,
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: "folder-a",
          name: "Active",
          color: "#3B82F6",
          icon: "Active",
          position: 3,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      tags: [{ id: "tag-keep", name: "Keep", color: "#34D399", createdAt: 1, updatedAt: 1 }],
      sessions: [
        {
          id: "session-1",
          name: "Imported session",
          description: "",
          folderId: "folder-a",
          tagIds: ["tag-keep", "tag-missing"],
          tabs: [
            {
              id: "tab-late",
              title: "Later tab",
              url: "https://later.example.com",
              favIconUrl: "",
              pinned: false,
              note: "",
              position: 7,
              createdAt: 7,
              lastOpenedAt: null,
            },
            {
              id: "tab-early",
              title: "Earlier tab",
              url: "https://earlier.example.com",
              favIconUrl: "",
              pinned: false,
              note: "",
              position: 1,
              createdAt: 1,
              lastOpenedAt: null,
            },
          ],
          note: "",
          createdAt: 1,
          updatedAt: 2,
          lastOpenedAt: 2,
          version: 0,
          isPinned: false,
          isArchived: false,
        },
      ],
      settings: {
        fuzzySearchThreshold: 0.9,
      },
    });

    expect(result.folders.map((folder) => folder.id)).toEqual(["folder-a", "folder-b"]);
    expect(result.folders.map((folder) => folder.position)).toEqual([0, 1]);
    expect(result.sessions[0]?.version).toBe(1);
    expect(result.sessions[0]?.tagIds).toEqual(["tag-keep"]);
    expect(result.sessions[0]?.tabs.map((tab) => tab.id)).toEqual(["tab-early", "tab-late"]);
    expect(result.sessions[0]?.tabs.map((tab) => tab.position)).toEqual([0, 1]);
    expect(result.settings.fuzzySearchThreshold).toBe(0.6);
  });

  it("runs schema migrations when importing older TabSetu backups", () => {
    const result = normalizeImportedStorageData({
      schemaVersion: 2,
      sessions: [
        {
          id: "session-1",
          name: "Shared",
          tabs: [{ id: "tab-1", title: "Docs", url: "https://example.com", position: 0 }],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      folders: [],
      tags: [],
      schedules: [],
      shareLinks: [
        {
          id: "share-1",
          sessionId: "session-1",
          type: "hosted",
          encodedData: "abc",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    expect(result.shareLinks[0]?.type).toBe("encoded-url");
  });

  it("repairs old generated capture names from saved tab titles", () => {
    const result = normalizeImportedStorageData({
      sessions: [
        {
          id: "session-1",
          name: "Session 13 May, 10:54 pm",
          tabs: [
            {
              id: "tab-1",
              title: "Project dashboard",
              url: "https://example.com/dashboard",
              position: 0,
            },
            {
              id: "tab-2",
              title: "Research notes",
              url: "https://example.com/notes",
              position: 1,
            },
          ],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    expect(result.sessions[0]?.name).toBe("Project dashboard + 1 tab");
  });

  it("rejects backups from newer schema versions", () => {
    expect(() =>
      normalizeImportedStorageData({
        schemaVersion: 999,
        sessions: [],
        folders: [],
      })
    ).toThrow("newer version of TabSetu");
  });
});

describe("concurrency-safe persistence merges", () => {
  it("preserves newer entities from another extension context", () => {
    const result = mergeLatestEntities(
      [folder("newer", 20), folder("background-created", 15)],
      [folder("newer", 10), folder("page-created", 21)]
    );

    expect(result.map((item) => item.id)).toEqual(["newer", "page-created", "background-created"]);
    expect(result[0]?.updatedAt).toBe(20);
  });

  it("does not resurrect an entity older than its deletion tombstone", () => {
    const [result] = mergeLatestEntities([folder("gone", 30, 30)], [folder("gone", 20)]);
    expect(result?.deletedAt).toBe(30);
  });

  it("turns reset omissions into tombstones for the next cloud merge", () => {
    const current = {
      ...getDefaultStorageData(),
      sessions: [session("remove-me", 10)],
      folders: [folder("remove-folder", 10)],
    };
    const result = prepareStorageReplacement(current, getDefaultStorageData(), 100);

    expect(result.sessions[0]).toMatchObject({ id: "remove-me", deletedAt: 100, updatedAt: 100 });
    expect(result.folders[0]).toMatchObject({
      id: "remove-folder",
      deletedAt: 100,
      updatedAt: 100,
    });
    expect(result.settings.updatedAt).toBe(100);
    expect(result.aiConfig.updatedAt).toBe(100);
  });

  it("serializes simultaneous full-array saves before merging them", async () => {
    await Promise.all([
      saveSessions([session("from-popup", 20)]),
      saveSessions([session("from-background", 21)]),
    ]);

    const stored = await loadStorage();
    expect(stored.sessions.map((item) => item.id).sort()).toEqual([
      "from-background",
      "from-popup",
    ]);
  });

  it("merges simultaneous settings patches instead of overwriting unrelated fields", async () => {
    await Promise.all([
      saveSettingsPatch({ theme: "dark", updatedAt: 20 }),
      saveSettingsPatch({ confirmBeforeDelete: false, updatedAt: 21 }),
    ]);

    const stored = await loadSettings();
    expect(stored.theme).toBe("dark");
    expect(stored.confirmBeforeDelete).toBe(false);
  });
});
