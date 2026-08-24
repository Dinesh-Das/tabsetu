import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadSync, GoogleDriveSyncError, uploadSync } from "@/lib/googleSync";
import { getDefaultStorageData } from "@/lib/storage";

async function storeValidToken(): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.storage.local.set(
      {
        TabSetu_google_oauth_token: {
          accessToken: "test-token",
          expiresAt: Date.now() + 60 * 60 * 1000,
        },
      },
      resolve
    );
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Google Drive sync failure handling", () => {
  it("does not treat a failed file lookup as an empty Drive", async () => {
    await storeValidToken();
    const fetchMock = vi.fn().mockResolvedValue(new Response("Drive unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadSync(getDefaultStorageData())).rejects.toThrow(
      "Google Drive file lookup failed (503)"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces download errors instead of returning no backup", async () => {
    await storeValidToken();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ files: [{ id: "drive-file" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(new Response("Download unavailable", { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadSync()).rejects.toThrow("Google Drive download failed (502)");
  });

  it("marks conditional upload conflicts for a safe re-merge", async () => {
    await storeValidToken();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ files: [{ id: "drive-file" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(new Response("Precondition failed", { status: 412 }));
    vi.stubGlobal("fetch", fetchMock);

    const error = await uploadSync(getDefaultStorageData(), {
      expectedRemote: { fileId: "drive-file", etag: '"version-1"', version: null },
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(GoogleDriveSyncError);
    expect((error as GoogleDriveSyncError).isConflict).toBe(true);
    const patchRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(patchRequest.headers).get("If-Match")).toBe('"version-1"');
  });

  it("returns null only after a successful lookup confirms no backup exists", async () => {
    await storeValidToken();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ files: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await expect(downloadSync()).resolves.toBeNull();
  });
});
