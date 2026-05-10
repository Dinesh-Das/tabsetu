import { describe, expect, it } from "vitest";
import { defaultSavedSessionTitle } from "@/lib/sessionLabels";
import type { TabItem } from "@/types";

function tab(id: string, title: string): TabItem {
  return {
    id,
    title,
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
    createdAt: 1,
    lastOpenedAt: null,
  };
}

describe("sessionLabels", () => {
  it("uses the first tab title for generated save names", () => {
    expect(defaultSavedSessionTitle(true, [tab("docs", "Project docs")])).toBe("Project docs");
    expect(
      defaultSavedSessionTitle(false, [tab("docs", "Project docs"), tab("mail", "Mail")])
    ).toBe("Project docs + 1 tab");
  });
});
