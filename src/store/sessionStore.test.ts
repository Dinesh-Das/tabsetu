import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadStorage } from "@/lib/storage";
import { flushSessionPersistence, useSessionStore } from "@/store/sessionStore";
import type { TabItem } from "@/types";

function tab(id: string, url = `https://${id}.example.com`): TabItem {
  return {
    id,
    title: id,
    url,
    favIconUrl: null,
    folderId: null,
    tagIds: [],
    pinned: false,
    windowId: 1,
    note: "",
    reminderAt: null,
    reminderSnoozedUntil: null,
    reminderDismissed: false,
    position: 99,
    openCount: 0,
    createdAt: 1,
    lastOpenedAt: null,
  };
}

describe("sessionStore", () => {
  beforeEach(() => {
    useSessionStore.getState().importSessions([]);
  });

  afterEach(async () => {
    await flushSessionPersistence();
  });

  it("maintains session, tab, organization, reminder, and deletion invariants", async () => {
    const created = useSessionStore
      .getState()
      .createSession("<b>Research</b>", "<i>Plan</i>", [tab("one")], "folder-a", ["tag-a"]);
    expect(created).toMatchObject({ name: "Research", description: "Plan", version: 1 });
    expect(created.tabs[0]?.position).toBe(0);

    expect(
      useSessionStore.getState().addTabToSession(created.id, tab("one-copy", created.tabs[0].url))
    ).toBe(false);
    expect(
      useSessionStore
        .getState()
        .addTabsToSession(created.id, [tab("two"), tab("two-copy", "https://two.example.com")])
    ).toBe(1);

    useSessionStore.getState().updateSession(created.id, {
      name: "<span>Updated</span>",
      description: "<p>Clean</p>",
    });
    useSessionStore.getState().updateSessionNote(created.id, "<b>Session note</b>");
    useSessionStore.getState().updateTabNote(created.id, "one", "<i>Tab note</i>");
    useSessionStore.getState().updateTabReminder(created.id, "one", 1234);
    useSessionStore.getState().updateTabFolder(created.id, "one", "folder-b");
    useSessionStore.getState().updateTabTags(created.id, "one", ["tag-b"]);
    useSessionStore.getState().recordTabOpened(created.id, "one");
    useSessionStore.getState().recordOpened(created.id);
    useSessionStore.getState().unassignFolder("folder-b");
    useSessionStore.getState().removeTagReferences("tag-b");
    useSessionStore.getState().pinSession(created.id, true);
    useSessionStore.getState().archiveSession(created.id, true);
    useSessionStore.getState().duplicateSession(created.id);

    const updated = useSessionStore.getState().sessions.find((item) => item.id === created.id);
    expect(updated).toMatchObject({
      name: "Updated",
      description: "Clean",
      note: "Session note",
      isPinned: true,
      isArchived: true,
      openCount: 1,
    });
    expect(updated?.tabs[0]).toMatchObject({
      note: "Tab note",
      reminderAt: 1234,
      folderId: null,
      tagIds: [],
      openCount: 2,
    });
    expect(useSessionStore.getState().sessions).toHaveLength(2);

    useSessionStore.getState().deleteSession(created.id);
    await flushSessionPersistence();
    expect(useSessionStore.getState().sessions.some((item) => item.id === created.id)).toBe(false);
    const persisted = await loadStorage({ includeDeleted: true });
    expect(persisted.sessions.find((item) => item.id === created.id)?.deletedAt).toEqual(
      expect.any(Number)
    );
  });
});
