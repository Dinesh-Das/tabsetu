import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasOptionalPermission,
  removeOptionalPermission,
  requestOptionalPermission,
} from "@/lib/optionalPermissions";

describe("optionalPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chrome.permissions.contains).mockImplementation((_permissions, callback) => {
      callback?.(false);
    });
    vi.mocked(chrome.permissions.request).mockImplementation((_permissions, callback) => {
      callback?.(true);
    });
    vi.mocked(chrome.permissions.remove).mockImplementation((_permissions, callback) => {
      callback?.(true);
    });
  });

  it("checks history permission without requesting it", async () => {
    await expect(hasOptionalPermission("history")).resolves.toBe(false);
    expect(chrome.permissions.contains).toHaveBeenCalledWith(
      { permissions: ["history"] },
      expect.any(Function)
    );
    expect(chrome.permissions.request).not.toHaveBeenCalled();
  });

  it("requests history only when the explicit helper is called", async () => {
    await expect(requestOptionalPermission("history")).resolves.toBe(true);
    expect(chrome.permissions.request).toHaveBeenCalledWith(
      { permissions: ["history"] },
      expect.any(Function)
    );
  });

  it("revokes history permission when disabling the feature", async () => {
    await expect(removeOptionalPermission("history")).resolves.toBe(true);
    expect(chrome.permissions.remove).toHaveBeenCalledWith(
      { permissions: ["history"] },
      expect.any(Function)
    );
  });
});
