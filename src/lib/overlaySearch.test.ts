import { describe, expect, it } from "vitest";
import { scoreOverlayRows, type OverlaySearchRow } from "@/lib/overlaySearch";

describe("scoreOverlayRows", () => {
  const rows: OverlaySearchRow[] = [
    {
      id: "active-tab-1",
      kind: "active-tab",
      title: "Chrome Extension Docs",
      subtitle: "https://developer.chrome.com/docs/extensions",
      action: { kind: "switch-tab", tabId: 1 },
      tabTitle: "Chrome Extension Docs",
      tabUrl: "https://developer.chrome.com/docs/extensions",
    },
  ];

  it("defaults missing search scope flags to enabled", () => {
    const results = scoreOverlayRows(rows, "extension", {
      searchScopes: {
        sessions: false,
        tabs: undefined as unknown as boolean,
        notes: false,
        tags: false,
        folders: false,
      },
      fuzzySearchThreshold: 0.32,
    });

    expect(results).toEqual(rows);
  });
});
