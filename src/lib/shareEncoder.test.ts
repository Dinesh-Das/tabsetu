import { expect, it, vi } from "vitest";
import {
  decodeSession,
  decodeShareSnapshot,
  encodeSession,
  encodeShareSnapshot,
  tryGenerateShareUrl,
} from "./shareEncoder";
import type { Session, ShareSnapshot, TabItem } from "@/types";

function makeTab(index: number, url = `https://example.com/${index}`): TabItem {
  return {
    id: `tab-${index}`,
    title: `Tab ${index}`,
    url,
    favIconUrl: null,
    folderId: null,
    tagIds: [],
    pinned: false,
    windowId: null,
    note: "",
    reminderAt: null,
    reminderSnoozedUntil: null,
    reminderDismissed: false,
    position: index,
    openCount: 0,
    createdAt: 1,
    lastOpenedAt: null,
  };
}

function makeSession(tabs: TabItem[]): Session {
  return {
    id: "session-1",
    name: "Shared session",
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

it("round-trips a large session without loss", () => {
  const session: ShareSnapshot = {
    v: 1,
    name: "Big session",
    description: "",
    createdAt: 1,
    tabs: Array.from({ length: 30 }, (_, i) => ({
      url: `https://example.com/page/${i}?q=${"x".repeat(200)}`,
      title: `Tab ${i}`,
    })),
  };

  const encoded = encodeSession(session);
  expect(encoded.length).toBeLessThan(2000);
  const decoded = decodeSession(encoded);
  expect(decoded).toEqual(session);
});

it("returns an explicit fallback for sessions that are too large for a URL", () => {
  const tabs = Array.from({ length: 180 }, (_, index) =>
    makeTab(index, `https://example.com/${index}?payload=${`${index}-`.repeat(120)}`)
  );

  expect(tryGenerateShareUrl(makeSession(tabs))).toEqual({
    ok: false,
    reason: "too-large",
    tabCount: tabs.length,
  });
});

it("does not perform network calls while encoding or decoding share links", () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  const snapshot: ShareSnapshot = {
    v: 1,
    name: "Local snapshot",
    description: "",
    tabs: [{ title: "Docs", url: "https://example.com/docs" }],
    createdAt: 1,
  };

  expect(decodeShareSnapshot(encodeShareSnapshot(snapshot))).toEqual(snapshot);
  expect(fetchSpy).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

it("rejects restricted URLs in imported snapshots", () => {
  const snapshot: ShareSnapshot = {
    v: 1,
    name: "Unsafe snapshot",
    description: "",
    tabs: [{ title: "Settings", url: "chrome://settings" }],
    createdAt: 1,
  };

  expect(() => decodeShareSnapshot(encodeShareSnapshot(snapshot))).toThrow("invalid");
});
