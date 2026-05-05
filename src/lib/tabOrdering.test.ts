import { describe, expect, it } from "vitest";
import { reorderTabsByIndex } from "@/lib/tabOrdering";
import type { TabItem } from "@/types";

function createTab(id: string, position: number): TabItem {
  return {
    id,
    title: id,
    url: `https://${id}.example.com`,
    favIconUrl: null,
    favIconDataUrl: null,
    folderId: null,
    tagIds: [],
    pinned: false,
    windowId: null,
    note: "",
    reminderAt: null,
    reminderSnoozedUntil: null,
    reminderDismissed: false,
    position,
    openCount: 0,
    createdAt: position,
    lastOpenedAt: null,
  };
}

describe("reorderTabsByIndex", () => {
  it("moves tabs by visual order and reindexes positions", () => {
    const tabs = [createTab("third", 2), createTab("first", 0), createTab("second", 1)];
    const reordered = reorderTabsByIndex(tabs, 0, 2);

    expect(reordered?.map((tab) => tab.id)).toEqual(["second", "third", "first"]);
    expect(reordered?.map((tab) => tab.position)).toEqual([0, 1, 2]);
  });

  it("returns null when the requested move is outside the list", () => {
    expect(reorderTabsByIndex([createTab("only", 0)], 0, 1)).toBeNull();
    expect(reorderTabsByIndex([createTab("only", 0)], 0, 0)).toBeNull();
  });
});
