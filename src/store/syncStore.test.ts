import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/googleSync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/googleSync")>();
  return {
    ...actual,
    downloadSync: vi.fn(),
    uploadSync: vi.fn(),
    getLastSyncedAt: vi.fn(),
    getSignedInEmail: vi.fn(),
    hasSilentAuthToken: vi.fn(),
  };
});

import { downloadSync, getLastSyncedAt, GoogleDriveSyncError, uploadSync } from "@/lib/googleSync";
import { getDefaultStorageData } from "@/lib/storage";
import { useSessionStore } from "@/store/sessionStore";
import { useSyncStore } from "@/store/syncStore";
import type { Session } from "@/types";

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

function snapshot(id: string, version: string) {
  return {
    data: { ...getDefaultStorageData(), sessions: [session(id, Number(version))] },
    fileId: "drive-file",
    etag: null,
    version,
  };
}

describe("syncStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.getState().importSessions([]);
    useSyncStore.setState({
      enabled: true,
      email: "person@example.com",
      lastSyncedAt: null,
      isSyncing: false,
      syncError: null,
    });
    vi.mocked(getLastSyncedAt).mockResolvedValue(1234);
    vi.mocked(uploadSync).mockResolvedValue(undefined);
  });

  it("merges, persists, uploads, and reloads a Drive snapshot", async () => {
    vi.mocked(downloadSync).mockResolvedValue(snapshot("remote", "2"));

    await useSyncStore.getState().syncNow();

    expect(useSyncStore.getState()).toMatchObject({
      isSyncing: false,
      lastSyncedAt: 1234,
      syncError: null,
    });
    expect(useSessionStore.getState().sessions.map((item) => item.id)).toContain("remote");
    expect(uploadSync).toHaveBeenCalledWith(
      expect.objectContaining({ sessions: [expect.objectContaining({ id: "remote" })] }),
      { expectedRemote: { fileId: "drive-file", etag: null, version: "2" } }
    );
  });

  it("downloads and re-merges once after a conditional upload conflict", async () => {
    vi.mocked(downloadSync)
      .mockResolvedValueOnce(snapshot("first", "2"))
      .mockResolvedValueOnce(snapshot("second", "3"));
    vi.mocked(uploadSync)
      .mockRejectedValueOnce(new GoogleDriveSyncError("conflict", 412))
      .mockResolvedValueOnce(undefined);

    await useSyncStore.getState().syncNow();

    expect(downloadSync).toHaveBeenCalledTimes(2);
    expect(uploadSync).toHaveBeenCalledTimes(2);
    expect(useSessionStore.getState().sessions.map((item) => item.id)).toEqual(
      expect.arrayContaining(["first", "second"])
    );
  });
});
