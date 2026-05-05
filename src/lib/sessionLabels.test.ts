import { describe, expect, it } from "vitest";
import { defaultSavedSessionTitle, displaySessionTitle } from "@/lib/sessionLabels";
import type { Session, TabItem } from "@/types";

function tab(id: string, title: string): TabItem {
  return {
    id,
    title,
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
    position: 0,
    openCount: 0,
    createdAt: 1,
    lastOpenedAt: null,
  };
}

function session(name: string, tabs: TabItem[]): Session {
  return {
    id: "session-1",
    name,
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

describe("sessionLabels", () => {
  it("uses the first tab title for generated save names", () => {
    expect(defaultSavedSessionTitle(true, [tab("docs", "Project docs")])).toBe("Project docs");
    expect(defaultSavedSessionTitle(false, [tab("docs", "Project docs"), tab("mail", "Mail")])).toBe(
      "Project docs + 1 tab",
    );
  });

  it("shows tab titles for older timestamp-generated session names", () => {
    expect(displaySessionTitle(session("Collapsed tabs 5 May, 10:22 am", [tab("docs", "Project docs")]))).toBe(
      "Project docs",
    );
  });

  it("keeps user-authored session names unchanged", () => {
    expect(displaySessionTitle(session("Client launch", [tab("docs", "Project docs")]))).toBe("Client launch");
  });
});
