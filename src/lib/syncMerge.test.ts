/**
 * Unit coverage for the last-write-wins Google Drive sync merge strategy.
 */
import { describe, expect, it } from "vitest";
import type { Session, StorageData } from "@/types";
import { getDefaultStorageData } from "@/lib/storage";
import { mergeStorageData } from "@/lib/syncMerge";

function session(id: string, updatedAt: number, deletedAt?: number): Session {
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
    createdAt: updatedAt,
    updatedAt,
    lastOpenedAt: null,
    version: 1,
    isPinned: false,
    isArchived: false,
    ...(deletedAt ? { deletedAt } : {}),
  };
}

function storageWithSessions(sessions: Session[]): StorageData {
  return { ...getDefaultStorageData(), sessions };
}

describe("mergeStorageData", () => {
  it("keeps the remote session when the remote copy is newer", () => {
    const result = mergeStorageData(storageWithSessions([session("same", 1)]), {
      sessions: [session("same", 2)],
    });

    expect(result.sessions[0]?.updatedAt).toBe(2);
  });

  it("keeps the local session when the local copy is newer", () => {
    const result = mergeStorageData(storageWithSessions([session("same", 3)]), {
      sessions: [session("same", 2)],
    });

    expect(result.sessions[0]?.updatedAt).toBe(3);
  });

  it("includes sessions that exist only remotely", () => {
    const result = mergeStorageData(storageWithSessions([]), {
      sessions: [session("remote", 2)],
    });

    expect(result.sessions.map((item) => item.id)).toEqual(["remote"]);
  });

  it("includes sessions that exist only locally", () => {
    const result = mergeStorageData(storageWithSessions([session("local", 2)]), {
      sessions: [],
    });

    expect(result.sessions.map((item) => item.id)).toEqual(["local"]);
  });

  it("always keeps local settings", () => {
    const local = getDefaultStorageData();
    const remote = getDefaultStorageData();
    local.settings.theme = "dark";
    remote.settings.theme = "light";

    const result = mergeStorageData(local, { settings: remote.settings });

    expect(result.settings.theme).toBe("dark");
  });

  it("uses settings updatedAt when settings sync is enabled", () => {
    const local = getDefaultStorageData();
    const remote = getDefaultStorageData();
    local.settings.updatedAt = 10;
    local.settings.openInNewWindow = true;
    remote.settings.updatedAt = 20;
    remote.settings.openInNewWindow = false;

    const result = mergeStorageData(local, { settings: remote.settings }, { mergeSettings: true });

    expect(result.settings.openInNewWindow).toBe(false);
  });

  it("keeps local settings when both timestamps are missing", () => {
    const local = getDefaultStorageData();
    const remote = getDefaultStorageData();
    delete (local.settings as Partial<typeof local.settings>).updatedAt;
    delete (remote.settings as Partial<typeof remote.settings>).updatedAt;
    local.settings.openInNewWindow = true;
    remote.settings.openInNewWindow = false;

    const result = mergeStorageData(local, { settings: remote.settings }, { mergeSettings: true });

    expect(result.settings.openInNewWindow).toBe(true);
  });

  it("treats newer tombstones as deletions by default", () => {
    const result = mergeStorageData(storageWithSessions([session("same", 10)]), {
      sessions: [session("same", 5, 20)],
    });

    expect(result.sessions).toEqual([]);
  });

  it("can retain tombstones for sync uploads", () => {
    const result = mergeStorageData(
      storageWithSessions([session("same", 10)]),
      {
        sessions: [session("same", 5, 20)],
      },
      { includeDeleted: true }
    );

    expect(result.sessions[0]?.deletedAt).toBe(20);
  });
});
