import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/storage";
import { buildSearchIndex, searchSessions } from "@/lib/fuzzySearch";
import type { Session, TabItem } from "@/types";

function createTab(id: string, note: string): TabItem {
  return {
    id,
    title: `Title ${id}`,
    url: `https://${id}.example.com`,
    favIconUrl: null,
    favIconDataUrl: null,
    pinned: false,
    windowId: null,
    note,
    reminderAt: null,
    reminderSnoozedUntil: null,
    reminderDismissed: false,
    position: 0,
    openCount: 0,
    createdAt: 1,
    lastOpenedAt: null,
  };
}

function createSession(tab: TabItem): Session {
  return {
    id: "session-1",
    name: "Research sprint",
    description: "",
    folderId: null,
    groupId: null,
    tagIds: [],
    tabs: [tab],
    note: "",
    color: null,
    icon: null,
    openCount: 0,
    createdAt: 1,
    updatedAt: 1,
    lastOpenedAt: 1,
    version: 1,
    isPinned: false,
    isArchived: false,
  };
}

describe("searchSessions", () => {
  it("returns highlight metadata and snippets for tab-note matches", () => {
    const tab = createTab("tab-1", "alpha release checklist");
    const searchIndex = buildSearchIndex(
      [createSession(tab)],
      [],
      [],
      {
        searchScopes: {
          ...DEFAULT_SETTINGS.searchScopes,
          sessions: false,
          tabs: false,
          tags: false,
          folders: false,
          notes: true,
        },
        fuzzySearchThreshold: 0.2,
      },
    );

    const results = searchSessions(searchIndex, "alpha");

    expect(results).toHaveLength(1);
    expect(results[0]?.highlights.tabNotes[tab.id]?.length).toBeGreaterThan(0);
    expect(results[0]?.snippets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `${tab.id}-note`,
          kind: "tabNote",
          text: tab.note,
        }),
      ]),
    );
  });
});
