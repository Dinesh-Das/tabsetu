import { afterEach, describe, expect, it, vi } from "vitest";
import { clearRememberedFavicons, getRememberedFaviconForOrigin } from "@/lib/favicon";
import { chromeTabToTabItemWithFavicon, collectTabsForSession, isValidUrl } from "@/lib/tabHelpers";

afterEach(() => {
  clearRememberedFavicons();
  vi.unstubAllGlobals();
});

describe("chromeTabToTabItemWithFavicon", () => {
  it("stores the original favicon URL on the tab item without fetching it", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const item = await chromeTabToTabItemWithFavicon(
      {
        title: "Example",
        url: "https://example.com/docs",
        favIconUrl: "https://example.com/favicon.ico",
      } as chrome.tabs.Tab,
      2
    );

    expect(item.favIconUrl).toBe("https://example.com/favicon.ico");
    expect(getRememberedFaviconForOrigin("https://example.com/other")).toBe(
      "https://example.com/favicon.ico"
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(item.position).toBe(2);
  });

  it("handles tabs without favicon URLs", async () => {
    const item = await chromeTabToTabItemWithFavicon(
      {
        title: "Example",
        url: "https://example.com/docs",
      } as chrome.tabs.Tab,
      0
    );

    expect(item.favIconUrl).toBeNull();
    expect(getRememberedFaviconForOrigin("https://example.com/other")).toBeNull();
  });
});

describe("isValidUrl", () => {
  it("allows only HTTP and HTTPS URLs", () => {
    expect(isValidUrl("https://example.com/path")).toBe(true);
    expect(isValidUrl("http://localhost:3000")).toBe(true);
    expect(isValidUrl("mailto:person@example.com")).toBe(false);
    expect(isValidUrl("intent://example.com")).toBe(false);
    expect(isValidUrl("ftp://example.com/file")).toBe(false);
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("collectTabsForSession", () => {
  it("excludes incognito tabs even when explicitly selected", async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([
      {
        id: 1,
        url: "https://public.example.com",
        incognito: false,
        pinned: false,
      } as chrome.tabs.Tab,
      {
        id: 2,
        url: "https://private.example.com",
        incognito: true,
        pinned: false,
      } as chrome.tabs.Tab,
    ]);

    const result = await collectTabsForSession({ selectedTabIds: [1, 2] });
    expect(result.map((tab) => tab.id)).toEqual([1]);
  });
});
