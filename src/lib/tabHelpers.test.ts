import { afterEach, describe, expect, it, vi } from "vitest";
import { chromeTabToTabItemWithFavicon, fetchFavIconDataUrl } from "@/lib/tabHelpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubChromeStorage() {
  const values: Record<string, unknown> = {};
  vi.stubGlobal("chrome", {
    runtime: {},
    storage: {
      local: {
        get: (keys: string[], callback: (result: Record<string, unknown>) => void) => {
          callback(Object.fromEntries(keys.map((key) => [key, values[key]])));
        },
        set: (value: Record<string, unknown>, callback?: () => void) => {
          Object.assign(values, value);
          callback?.();
        },
      },
    },
  });
  return values;
}

describe("fetchFavIconDataUrl", () => {
  it("converts a successful image response into a data URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<() => Promise<Response>>(() =>
        Promise.resolve(
          new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { "content-type": "image/png" },
          })
        )
      )
    );

    await expect(fetchFavIconDataUrl("https://example.com/favicon.png")).resolves.toBe(
      "data:image/png;base64,AQID"
    );
  });

  it("returns null for a missing favicon URL", async () => {
    await expect(fetchFavIconDataUrl(null)).resolves.toBeNull();
  });

  it("returns null for an unsuccessful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<() => Promise<Response>>(() => Promise.resolve(new Response(null, { status: 404 })))
    );

    await expect(fetchFavIconDataUrl("https://example.com/missing.ico")).resolves.toBeNull();
  });

  it("returns null when the network request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<() => Promise<Response>>(() => Promise.reject(new Error("network unavailable")))
    );

    await expect(fetchFavIconDataUrl("https://example.com/favicon.ico")).resolves.toBeNull();
  });

  it("stores fetched favicon data separately from converted Chrome tabs", async () => {
    const values = stubChromeStorage();
    vi.stubGlobal(
      "fetch",
      vi.fn<() => Promise<Response>>(() =>
        Promise.resolve(
          new Response(new Uint8Array([4, 5, 6]), {
            status: 200,
            headers: { "content-type": "image/x-icon" },
          })
        )
      )
    );

    const item = await chromeTabToTabItemWithFavicon(
      {
        title: "Example",
        url: "https://example.com",
        favIconUrl: "https://example.com/favicon.ico",
      } as chrome.tabs.Tab,
      2
    );

    expect(item.favIconUrl).toBe("https://example.com/favicon.ico");
    expect(values.TabSetu_favicons).toEqual({ [item.id]: "data:image/x-icon;base64,BAUG" });
    expect(item.position).toBe(2);
  });
});
