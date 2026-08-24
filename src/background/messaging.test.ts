import { describe, expect, it, vi } from "vitest";
import { createSessionFromWindow } from "@/background/messaging";
import { loadStorage } from "@/lib/storage";

const queryTabsMock = chrome.tabs.query as unknown as ReturnType<
  typeof vi.fn<(options: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>>
>;

function browserTab(id: number, incognito: boolean): chrome.tabs.Tab {
  return {
    id,
    title: incognito ? "Private" : "Public",
    url: incognito ? "https://private.example.com" : "https://public.example.com",
    index: id,
    windowId: 1,
    active: id === 1,
    highlighted: false,
    incognito,
    pinned: false,
    selected: false,
    groupId: -1,
  } as chrome.tabs.Tab;
}

describe("background session capture", () => {
  it("refuses to persist an incognito-only window", async () => {
    queryTabsMock.mockResolvedValueOnce([browserTab(1, true)]);
    await expect(createSessionFromWindow("save")).resolves.toBeNull();
    expect((await loadStorage()).sessions).toEqual([]);
  });

  it("captures regular tabs while excluding private tabs in the same query", async () => {
    queryTabsMock.mockResolvedValueOnce([browserTab(1, false), browserTab(2, true)]);
    const result = await createSessionFromWindow("save");

    expect(result).toMatchObject({ tabCount: 1, mode: "save" });
    expect(result?.session.tabs.map((tab) => tab.url)).toEqual(["https://public.example.com"]);
  });
});
