import { describe, expect, it, vi } from "vitest";
import { commitCollapseTransaction } from "@/lib/collapseTransaction";
import type { UndoCollapseBuffer } from "@/types";

const buffer: UndoCollapseBuffer = {
  sessionId: "session-1",
  sessionName: "Session",
  tabs: [],
  windowId: 1,
  createdAt: 1,
  expiresAt: 2,
};

describe("commitCollapseTransaction", () => {
  it("persists the session and undo buffer before closing browser tabs", async () => {
    const order: string[] = [];

    await commitCollapseTransaction({
      buffer,
      flushSession: () => {
        order.push("session");
        return Promise.resolve();
      },
      persistUndoBuffer: () => {
        order.push("undo");
        return Promise.resolve();
      },
      closeBrowserTabs: () => {
        order.push("close");
        return Promise.resolve();
      },
    });

    expect(order).toEqual(["session", "undo", "close"]);
  });

  it("does not close tabs when durable storage fails", async () => {
    const closeBrowserTabs = vi.fn(() => Promise.resolve());

    await expect(
      commitCollapseTransaction({
        buffer,
        flushSession: () => Promise.reject(new Error("quota exceeded")),
        persistUndoBuffer: () => Promise.resolve(),
        closeBrowserTabs,
      })
    ).rejects.toThrow("quota exceeded");

    expect(closeBrowserTabs).not.toHaveBeenCalled();
  });
});
