import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/storage";
import { buildSessionListItems, sortSessions } from "@/lib/sessionQuery";
import type { Folder, Session, Tag, TabItem } from "@/types";

function createTab(id: string, createdAt: number): TabItem {
  return {
    id,
    title: `Tab ${id}`,
    url: `https://${id}.example.com`,
    favIconUrl: null,
    folderId: null,
    tagIds: [],
    pinned: false,
    windowId: null,
    note: "",
    reminderAt: null,
    reminderSnoozedUntil: null,
    reminderDismissed: false,
    position: 0,
    openCount: 0,
    createdAt,
    lastOpenedAt: createdAt,
  };
}

function createSession(
  id: string,
  lastOpenedAt: number,
  folderId: string | null,
  tagIds: string[]
): Session {
  return {
    id,
    name: `Session ${id}`,
    description: "",
    folderId,
    tagIds,
    tabs: [createTab(`${id}-tab`, lastOpenedAt)],
    note: "",
    color: null,
    icon: null,
    openCount: 0,
    createdAt: lastOpenedAt - 20,
    updatedAt: lastOpenedAt - 10,
    lastOpenedAt,
    version: 1,
    isPinned: false,
    isArchived: false,
  };
}

const folders: Folder[] = [
  {
    id: "folder-work",
    name: "Work",
    color: "#3B82F6",
    icon: "Work",
    position: 0,
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: "folder-life",
    name: "Life",
    color: "#10B981",
    icon: "Life",
    position: 1,
    createdAt: 1,
    updatedAt: 1,
  },
];

const tags: Tag[] = [
  { id: "tag-focus", name: "Focus", color: "#34D399", createdAt: 1 },
  { id: "tag-later", name: "Later", color: "#FCD34D", createdAt: 1 },
];

describe("buildSessionListItems", () => {
  it("sorts sessions by last opened time in descending order", () => {
    const items = buildSessionListItems({
      sessions: [
        createSession("a", 100, "folder-work", ["tag-focus"]),
        createSession("b", 300, "folder-life", ["tag-later"]),
        createSession("c", 200, null, []),
      ],
      folders,
      tags,
      settings: {
        searchScopes: DEFAULT_SETTINGS.searchScopes,
        fuzzySearchThreshold: DEFAULT_SETTINGS.fuzzySearchThreshold,
      },
      query: "",
      sortBy: "lastOpenedAt",
    });

    expect(items.map((item) => item.session.id)).toEqual(["b", "c", "a"]);
  });

  it("applies folder and tag filters together", () => {
    const items = buildSessionListItems({
      sessions: [
        createSession("a", 100, "folder-work", ["tag-focus"]),
        createSession("b", 300, "folder-work", ["tag-later"]),
        createSession("c", 200, "folder-life", ["tag-focus"]),
      ],
      folders,
      tags,
      settings: {
        searchScopes: DEFAULT_SETTINGS.searchScopes,
        fuzzySearchThreshold: DEFAULT_SETTINGS.fuzzySearchThreshold,
      },
      query: "",
      sortBy: "updatedAt",
      folderId: "folder-work",
      tagId: "tag-focus",
    });

    expect(items.map((item) => item.session.id)).toEqual(["a"]);
  });

  it("applies folder and tag filters to tab-level organization", () => {
    const tabOrganizedSession = createSession("tab-level", 400, null, []);
    tabOrganizedSession.tabs = [
      {
        ...tabOrganizedSession.tabs[0],
        folderId: "folder-work",
        tagIds: ["tag-focus"],
      },
    ];

    const items = buildSessionListItems({
      sessions: [
        createSession("session-level", 100, "folder-life", ["tag-later"]),
        tabOrganizedSession,
      ],
      folders,
      tags,
      settings: {
        searchScopes: DEFAULT_SETTINGS.searchScopes,
        fuzzySearchThreshold: DEFAULT_SETTINGS.fuzzySearchThreshold,
      },
      query: "",
      sortBy: "updatedAt",
      folderId: "folder-work",
      tagId: "tag-focus",
    });

    expect(items.map((item) => item.session.id)).toEqual(["tab-level"]);
  });
});

describe("sortSessions", () => {
  const sortableSessions: Session[] = [
    {
      ...createSession("alpha", 200, null, []),
      name: "Gamma",
      createdAt: 10,
      updatedAt: 40,
      lastOpenedAt: 100,
      tabs: [createTab("alpha-tab-1", 10), createTab("alpha-tab-2", 10)],
    },
    {
      ...createSession("bravo", 300, null, []),
      name: "Alpha",
      createdAt: 30,
      updatedAt: 20,
      lastOpenedAt: null,
      tabs: [createTab("bravo-tab-1", 30)],
    },
    {
      ...createSession("charlie", 100, null, []),
      name: "Beta",
      createdAt: 20,
      updatedAt: 60,
      lastOpenedAt: 300,
      tabs: [
        createTab("charlie-tab-1", 20),
        createTab("charlie-tab-2", 20),
        createTab("charlie-tab-3", 20),
      ],
    },
  ];

  it("orders popup sort options consistently", () => {
    expect(sortSessions(sortableSessions, "updatedAt").map((session) => session.id)).toEqual([
      "charlie",
      "alpha",
      "bravo",
    ]);
    expect(sortSessions(sortableSessions, "lastOpenedAt").map((session) => session.id)).toEqual([
      "charlie",
      "alpha",
      "bravo",
    ]);
    expect(sortSessions(sortableSessions, "name").map((session) => session.name)).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);
    expect(sortSessions(sortableSessions, "tabCount").map((session) => session.id)).toEqual([
      "charlie",
      "alpha",
      "bravo",
    ]);
    expect(sortSessions(sortableSessions, "createdAt").map((session) => session.id)).toEqual([
      "bravo",
      "charlie",
      "alpha",
    ]);
  });
});
