import { beforeEach, describe, expect, it, vi } from "vitest";
import { openSessionTabsDetailed } from "@/lib/sessionBrowser";
import type { Session, TabItem } from "@/types";

const groupTabsMock = vi.fn<(options: chrome.tabs.GroupOptions) => Promise<number>>();
const updateGroupMock =
  vi.fn<
    (
      groupId: number,
      updateProperties: chrome.tabGroups.UpdateProperties
    ) => Promise<chrome.tabGroups.TabGroup>
  >();
const createTabMock = chrome.tabs.create as unknown as ReturnType<
  typeof vi.fn<(options: chrome.tabs.CreateProperties) => Promise<chrome.tabs.Tab>>
>;
const updateTabMock = chrome.tabs.update as unknown as ReturnType<
  typeof vi.fn<(tabId: number, options: chrome.tabs.UpdateProperties) => Promise<chrome.tabs.Tab>>
>;
const createWindowMock = chrome.windows.create as unknown as ReturnType<
  typeof vi.fn<(options: chrome.windows.CreateData) => Promise<chrome.windows.Window>>
>;

Object.defineProperty(chrome.tabs, "group", { configurable: true, value: groupTabsMock });
Object.defineProperty(chrome, "tabGroups", {
  configurable: true,
  value: { update: updateGroupMock },
});

function savedTab(id: string, position: number, updates: Partial<TabItem> = {}): TabItem {
  return {
    id,
    title: id,
    url: `https://${id}.example.com`,
    favIconUrl: null,
    folderId: null,
    tagIds: [],
    pinned: false,
    muted: false,
    windowId: 10,
    groupKey: null,
    groupTitle: null,
    groupColor: null,
    groupCollapsed: false,
    note: "",
    reminderAt: null,
    reminderSnoozedUntil: null,
    reminderDismissed: false,
    position,
    openCount: 0,
    createdAt: 1,
    lastOpenedAt: null,
    ...updates,
  };
}

function session(tabs: TabItem[]): Session {
  return {
    id: "session-1",
    name: "Restore me",
    description: "",
    folderId: null,
    tagIds: [],
    tabs,
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

function browserTab(id: number, windowId = 50): chrome.tabs.Tab {
  return {
    id,
    index: id,
    windowId,
    active: false,
    highlighted: false,
    incognito: false,
    pinned: false,
    selected: false,
  } as chrome.tabs.Tab;
}

describe("openSessionTabsDetailed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateTabMock.mockResolvedValue(browserTab(1));
    groupTabsMock.mockResolvedValue(77);
    updateGroupMock.mockResolvedValue({
      id: 77,
      collapsed: false,
      color: "blue",
      windowId: 50,
    });
  });

  it("restores saved order, pinned and muted state, and tab-group metadata", async () => {
    createTabMock.mockResolvedValueOnce(browserTab(101)).mockResolvedValueOnce(browserTab(102));
    const result = await openSessionTabsDetailed(
      session([
        savedTab("second", 2, {
          groupKey: "research",
        }),
        savedTab("first", 1, {
          pinned: true,
          muted: true,
          groupKey: "research",
          groupTitle: "Research",
          groupColor: "purple",
          groupCollapsed: true,
        }),
      ]),
      false
    );

    expect(result).toMatchObject({ openedCount: 2, failedTabs: [], warnings: [] });
    expect(vi.mocked(chrome.tabs.create).mock.calls.map(([options]) => options.url)).toEqual([
      "https://first.example.com",
      "https://second.example.com",
    ]);
    expect(chrome.tabs.update).toHaveBeenCalledWith(101, { pinned: true, muted: true });
    expect(chrome.tabs.group).toHaveBeenCalledWith({ tabIds: [101, 102] });
    expect(chrome.tabGroups.update).toHaveBeenCalledWith(77, {
      collapsed: true,
      title: "Research",
      color: "purple",
    });
  });

  it("reports individual failures while keeping successfully opened tabs", async () => {
    createTabMock
      .mockResolvedValueOnce(browserTab(201))
      .mockRejectedValueOnce(new Error("Blocked URL"));

    const result = await openSessionTabsDetailed(
      session([savedTab("works", 0), savedTab("fails", 1)]),
      false
    );

    expect(result.openedCount).toBe(1);
    expect(result.failedTabs).toEqual([
      expect.objectContaining({ tabId: "fails", error: "Blocked URL" }),
    ]);
  });

  it("recreates distinct saved windows when new-window restore is enabled", async () => {
    createWindowMock
      .mockResolvedValueOnce({
        id: 61,
        focused: true,
        incognito: false,
        alwaysOnTop: false,
        tabs: [browserTab(301, 61)],
      })
      .mockResolvedValueOnce({
        id: 62,
        focused: true,
        incognito: false,
        alwaysOnTop: false,
        tabs: [browserTab(302, 62)],
      });

    const result = await openSessionTabsDetailed(
      session([savedTab("window-a", 0, { windowId: 1 }), savedTab("window-b", 1, { windowId: 2 })]),
      true
    );

    expect(result.openedCount).toBe(2);
    expect(chrome.windows.create).toHaveBeenCalledTimes(2);
  });
});
