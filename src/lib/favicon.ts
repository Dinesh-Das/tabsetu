import type { Session } from "@/types";

export const FAVICON_STORAGE_KEY = "TabSetu_favicons";

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

const TRACKER_DOMAIN_BLOCKLIST = new Set([
  "doubleclick.net",
  "googletagmanager.com",
  "google-analytics.com",
  "googlesyndication.com",
  "facebook.net",
  "facebook.com",
  "analytics.twitter.com",
  "scorecardresearch.com",
  "hotjar.com",
]);

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    chunks.push(String.fromCharCode(...chunk));
  }

  return btoa(chunks.join(""));
}

function isBlockedTrackerHost(hostname: string): boolean {
  return [...TRACKER_DOMAIN_BLOCKLIST].some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );
}

export async function fetchFavIconDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) {
    return null;
  }

  if (url.startsWith("data:image/")) {
    return url;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" || isBlockedTrackerHost(parsed.hostname.toLowerCase())) {
    return null;
  }

  try {
    const response = await fetch(parsed.href);
    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = await response.arrayBuffer();
    return `data:${contentType};base64,${arrayBufferToBase64(buffer)}`;
  } catch {
    return null;
  }
}

function getStoredFavicons(): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([FAVICON_STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      const value: unknown = result[FAVICON_STORAGE_KEY];
      resolve(isStringRecord(value) ? value : {});
    });
  });
}

export async function storeFavicon(tabId: string, dataUrl: string | null): Promise<void> {
  if (!dataUrl) {
    return;
  }

  const favicons = await getStoredFavicons();
  await chrome.storage.local.set({
    [FAVICON_STORAGE_KEY]: {
      ...favicons,
      [tabId]: dataUrl,
    },
  });
}

export async function pruneStaleTabFavicons(activeSessions: Session[]): Promise<void> {
  const favicons = await getStoredFavicons();
  const activeTabIds = new Set(
    activeSessions.flatMap((session) => session.tabs.map((tab) => tab.id))
  );
  const pruned = Object.fromEntries(
    Object.entries(favicons).filter(([tabId]) => activeTabIds.has(tabId))
  );

  if (Object.keys(pruned).length === Object.keys(favicons).length) {
    return;
  }

  await chrome.storage.local.set({ [FAVICON_STORAGE_KEY]: pruned });
}
