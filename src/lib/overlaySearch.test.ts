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
        browserHistory: false,
      },
      fuzzySearchThreshold: 0.32,
    });

    expect(results).toEqual(rows);
  });

  it("does not return browser history rows when the optional scope is off", () => {
    const historyRows: OverlaySearchRow[] = [
      {
        id: "history-1",
        kind: "history",
        title: "Private research",
        subtitle: "https://example.com/research",
        action: { kind: "url", url: "https://example.com/research" },
        historyTitle: "Private research",
        historyUrl: "https://example.com/research",
      },
    ];

    expect(
      scoreOverlayRows(historyRows, "research", {
        searchScopes: {
          sessions: true,
          tabs: true,
          notes: true,
          tags: true,
          folders: true,
          browserHistory: false,
        },
        fuzzySearchThreshold: 0.32,
      })
    ).toEqual([]);
  });
});
