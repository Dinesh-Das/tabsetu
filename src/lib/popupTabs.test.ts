import { describe, expect, it } from "vitest";
import { countSelectedVisibleTabs, filterCapturableTabs } from "@/lib/popupTabs";

function tab(id: number, title: string, url: string): chrome.tabs.Tab {
  return { id, title, url, index: id, pinned: false, highlighted: false, active: false, incognito: false, selected: false } as chrome.tabs.Tab;
}

describe("popup tab helpers", () => {
  it("filters restricted tabs before rendering selectable rows", () => {
    const result = filterCapturableTabs([
      tab(1, "Chrome settings", "chrome://settings"),
      tab(2, "Supabase Docs", "https://supabase.com/docs"),
      tab(3, "Blank", "about:blank"),
    ]);

    expect(result.map((item) => item.id)).toEqual([2]);
  });

  it("matches query against title and url", () => {
    const result = filterCapturableTabs(
      [
        tab(1, "Design notes", "https://example.com"),
        tab(2, "Repository", "https://github.com/org/repo"),
      ],
      "github",
    );

    expect(result.map((item) => item.id)).toEqual([2]);
  });

  it("counts only selected tabs that are visible and capturable", () => {
    const result = countSelectedVisibleTabs(
      [
        tab(1, "A", "https://a.example.com"),
        tab(2, "B", "chrome://extensions"),
        tab(3, "C", "https://c.example.com"),
      ],
      [1, 2, 4],
    );

    expect(result).toBe(1);
  });
});
