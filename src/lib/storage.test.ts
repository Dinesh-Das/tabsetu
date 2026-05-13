import { describe, expect, it } from "vitest";
import { normalizeImportedStorageData } from "@/lib/storage";

describe("normalizeImportedStorageData", () => {
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
      tags: [{ id: "tag-keep", name: "Keep", color: "#34D399", createdAt: 1 }],
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
